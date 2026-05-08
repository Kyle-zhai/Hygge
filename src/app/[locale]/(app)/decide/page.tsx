// Sessions list — the "history" landing for /decide. Renders past
// decisions and a primary CTA to start a new one.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  // Pull a one-line preview of the latest brief in each session so the
  // list isn't anemic — title + timestamp alone make every row look the
  // same. Fall back to the session title or "untitled" when no brief yet.
  const { data: sessions } = await supabase
    .from("decision_sessions")
    .select(`
      id, title, last_msg_at, created_at,
      decision_briefs(canonical_question, status, created_at)
    `)
    .eq("user_id", user.id)
    .order("last_msg_at", { ascending: false })
    .limit(50);

  return (
    <div className="container max-w-3xl py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("homeTitleSharper")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("homeSubtitleSharper")}</p>
        </div>
        <Link href={`/${locale}/decide/new`}>
          <Button className="gap-1">
            <Plus className="size-4" aria-hidden="true" />
            {t("newDecision")}
          </Button>
        </Link>
      </header>

      {!sessions || sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("homeEmpty")}</p>
            <Link href={`/${locale}/decide/new`} className="mt-4 inline-block">
              <Button className="gap-1">
                <Plus className="size-4" aria-hidden="true" />
                {t("newDecision")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const briefs = (s.decision_briefs ?? []) as Array<{
              canonical_question: string;
              status: string;
              created_at: string;
            }>;
            const latest = briefs.length
              ? [...briefs].sort((a, b) => (b.created_at > a.created_at ? 1 : -1))[0]
              : null;
            const preview = latest?.canonical_question ?? s.title ?? t("untitledSession");
            const status = latest?.status ?? null;
            return (
              <li key={s.id}>
                <Link
                  href={`/${locale}/decide/${s.id}`}
                  className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 flex-1 text-sm font-medium">
                      {preview}
                    </p>
                    {status && (
                      <Badge
                        variant={status === "completed" ? "default" : "outline"}
                        className="shrink-0"
                      >
                        {t(`briefStatusLabel.${status}` as const)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(s.last_msg_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
