// Sessions list — bare list, no Card stacking. Tight typography, single
// status pill per row, hover state tints the row instead of a shadow.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
    .select(`
      id, title, last_msg_at, created_at,
      decision_briefs(canonical_question, status, created_at)
    `)
    .eq("user_id", user.id)
    .order("last_msg_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pt-20 pb-16">
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
            {t("homeTitleSharper")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("homeSubtitleSharper")}
          </p>
        </div>
        <Link
          href={`/${locale}/decide/new`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/40"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t("newDecision")}
        </Link>
      </header>

      {!sessions || sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("homeEmpty")}</p>
          <Link
            href={`/${locale}/decide/new`}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t("newDecision")}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
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
                  className="group flex items-start justify-between gap-4 px-1 py-5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">
                      {preview}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {new Date(s.last_msg_at).toLocaleString()}
                      {status ? (
                        <>
                          <span className="mx-1.5 text-muted-foreground/40">·</span>
                          <span className="text-muted-foreground">
                            {t(`briefStatusLabel.${status}` as const)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
