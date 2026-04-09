import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { UserMenu } from "./user-menu";
import { ScrollHeader } from "./scroll-header";

export async function Header() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ScrollHeader>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          {/* Logo — three overlapping circles: multi-perspective warmth */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <circle cx="10" cy="10" r="7" stroke="#C4A882" strokeWidth="1.5" opacity="0.5" />
            <circle cx="14" cy="10" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.7" />
            <circle cx="12" cy="14" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.9" />
          </svg>
          <span className="text-xl font-semibold italic text-[#EAEAE8]">
            Hygge
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <LocaleSwitcher />
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C]"
              >
                <Link href={`/${locale}/dashboard`}>{t("dashboard")}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C]"
              >
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <UserMenu email={user.email ?? ""} />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C]"
              >
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C]"
              >
                <Link href={`/${locale}/auth/login`}>{t("login")}</Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] rounded-lg font-semibold"
              >
                <Link href={`/${locale}/auth/register`}>{t("register")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </ScrollHeader>
  );
}
