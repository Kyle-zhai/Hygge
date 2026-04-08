import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("common");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("settings")}</h1>
    </div>
  );
}
