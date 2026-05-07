// Sessions list — the "history" landing for /decide. Renders past
// decisions and a primary CTA to start a new one.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DecideHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "decide" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const { data: sessions } = await supabase
    .from("decision_sessions")
    .select("id, title, last_msg_at, created_at")
    .eq("user_id", user.id)
    .order("last_msg_at", { ascending: false })
    .limit(50);

  return (
    <div className="container max-w-3xl py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("homeTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("homeSubtitle")}</p>
        </div>
        <Link href={`/${locale}/decide/new`}>
          <Button>+ {t("newDecision")}</Button>
        </Link>
      </header>

      {!sessions || sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("homeEmpty")}</p>
            <Link href={`/${locale}/decide/new`} className="mt-4 inline-block">
              <Button>{t("newDecision")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/${locale}/decide/${s.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <p className="line-clamp-1 text-sm font-medium">
                      {s.title ?? t("untitledSession")}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.last_msg_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
