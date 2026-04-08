import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { UserMenu } from "./user-menu";

export async function Header() {
  const t = await getTranslations("common");
  const locale = useLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="text-xl font-bold">{t("appName")}</span>
        </Link>

        <nav className="flex items-center gap-2">
          <LocaleSwitcher />
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/dashboard`}>{t("dashboard")}</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <UserMenu email={user.email ?? ""} />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/auth/login`}>{t("login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/${locale}/auth/register`}>{t("register")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
