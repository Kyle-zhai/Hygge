import { getTranslations } from "next-intl/server";

export default async function PricingPage() {
  const t = await getTranslations("pricing");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("title")}</h1>
    </div>
  );
}
