import { getTranslations } from "next-intl/server";

export default async function EvaluationResultPage() {
  const t = await getTranslations("evaluation");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("completed")}</h1>
    </div>
  );
}
