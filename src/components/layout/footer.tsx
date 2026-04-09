import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("common");

  return (
    <footer className="border-t border-[#1C1C1C] bg-[#0C0C0C] py-8">
      <div className="container flex items-center justify-center">
        <p className="text-sm text-[#666462]">
          &copy; {new Date().getFullYear()} {t("appName")}. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
