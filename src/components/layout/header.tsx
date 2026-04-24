import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./user-menu";
import { ScrollHeader } from "./scroll-header";
import { ThemeToggle } from "./theme-toggle";

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
            <circle cx="10" cy="10" r="7" stroke="var(--accent-warm)" strokeWidth="1.5" opacity="0.5" />
            <circle cx="14" cy="10" r="7" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.7" />
            <circle cx="12" cy="14" r="7" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.9" />
          </svg>
          <span className="text-xl font-semibold italic text-[color:var(--text-primary)]">
            Hygge
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]"
              >
                <Link href={`/${locale}/evaluate/new`}>{t("dashboard")}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]"
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
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]"
              >
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]"
              >
                <Link href={`/${locale}/auth/login`}>{t("login")}</Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--accent-ink)] rounded-lg font-semibold"
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
