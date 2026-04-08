import { getTranslations } from "next-intl/server";

export default async function NewEvaluationPage() {
  const t = await getTranslations("evaluation");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("selectPersonas")}</h1>
      <p className="mt-4 text-muted-foreground">{t("inputPlaceholder")}</p>
    </div>
  );
}
