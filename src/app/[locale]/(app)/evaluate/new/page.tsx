// Legacy /evaluate/new — replaced by /decide.
// Renders a small "we moved" interstitial and links to /decide. Existing
// evaluation share links under /evaluate/[id] still work because that
// route is unchanged (read-only history).

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function NewEvaluationRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "decide" });

  return (
    <div className="container max-w-xl py-16">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{t("evaluateRedirectTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("evaluateRedirectBody")}</p>
        </CardHeader>
        <CardContent>
          <Link href={`/${locale}/decide/new`}>
            <Button>{t("evaluateRedirectCta")} →</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
