import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("common");

  return (
    <footer className="border-t border-[color:var(--border-default)] bg-[color:var(--bg-primary)] py-8">
      <div className="container flex items-center justify-center">
        <p className="text-sm text-[color:var(--text-tertiary)]">
          &copy; {new Date().getFullYear()} {t("appName")}. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
