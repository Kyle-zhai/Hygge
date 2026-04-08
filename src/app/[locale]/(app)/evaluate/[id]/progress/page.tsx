import { getTranslations } from "next-intl/server";

export default async function EvaluationProgressPage() {
  const t = await getTranslations("evaluation");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("inProgress")}</h1>
    </div>
  );
}
