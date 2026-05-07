"use client";

// New decision: minimal page that takes the user's first question, creates
// a session, posts the user_text message, then redirects to /decide/[id]
// where the chat thread takes over.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createDecisionSession } from "@/lib/decide/use-decision-session";

export default function NewDecisionPage() {
  const t = useTranslations("decide");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createDecisionSession();
      const res = await fetch(`/api/decisions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "user_text", content: text.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/${locale}/decide/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="container max-w-2xl py-12">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{t("newDecisionTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("newDecisionSubtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <textarea
              autoFocus
              className="min-h-[180px] w-full resize-none rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("newDecisionPlaceholder")}
              disabled={submitting}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={!text.trim() || submitting}>
                {submitting ? t("submitting") : t("startAnalysis")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
