"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

interface SubscriptionRow {
  plan: string;
  evaluations_used: number;
  evaluations_limit: number;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
}

interface EvaluationRow {
  id: string;
  status: string;
  mode: string;
  created_at: string;
  error_message: string | null;
}

interface SearchResult {
  user: UserRow | null;
  subscription?: SubscriptionRow | null;
  recentEvaluations?: EvaluationRow[];
  personaCount?: number;
}

const PLANS = ["free", "pro", "max"] as const;

export function AdminPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/users?email=${encodeURIComponent(email.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function update(userId: string, body: { plan?: string; resetEvaluations?: boolean }) {
    setActionLoading(true);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult((prev) =>
        prev && prev.user
          ? { ...prev, subscription: { ...(prev.subscription ?? {} as SubscriptionRow), ...json.subscription } }
          : prev,
      );
      setFlash(`Updated: ${Object.keys(body).join(", ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-[#2A2A2A] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-[#EAEAE8]">Look up user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-[#2A2A2A] bg-[#1C1C1C] text-[#EAEAE8]"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? "Searching…" : "Search"}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {flash && <p className="mt-3 text-sm text-emerald-400">{flash}</p>}
        </CardContent>
      </Card>

      {result && result.user === null && (
        <Card className="border-[#2A2A2A] bg-[#141414]">
          <CardContent className="py-6">
            <p className="text-sm text-[#9B9594]">No user found for that email.</p>
          </CardContent>
        </Card>
      )}

      {result?.user && (
        <>
          <Card className="border-[#2A2A2A] bg-[#141414]">
            <CardHeader>
              <CardTitle className="text-[#EAEAE8]">User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Email" value={result.user.email} />
              <Row label="ID" value={result.user.id} mono />
              <Row label="Registered" value={new Date(result.user.created_at).toLocaleString()} />
              <Row label="Personas created" value={String(result.personaCount ?? 0)} />
            </CardContent>
          </Card>

          <Card className="border-[#2A2A2A] bg-[#141414]">
            <CardHeader>
              <CardTitle className="text-[#EAEAE8]">Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result.subscription ? (
                <>
                  <Row label="Plan" value={result.subscription.plan.toUpperCase()} />
                  <Row
                    label="Evaluations"
                    value={`${result.subscription.evaluations_used} / ${result.subscription.evaluations_limit}`}
                  />
                  <Row
                    label="Period end"
                    value={
                      result.subscription.current_period_end
                        ? new Date(result.subscription.current_period_end).toLocaleString()
                        : "—"
                    }
                  />
                  <Row label="Stripe sub" value={result.subscription.stripe_subscription_id ?? "—"} mono />

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#2A2A2A] pt-4">
                    {PLANS.map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={result.subscription?.plan === p ? "default" : "outline"}
                        disabled={actionLoading || result.subscription?.plan === p}
                        onClick={() => update(result.user!.id, { plan: p })}
                      >
                        Set {p.toUpperCase()}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => update(result.user!.id, { resetEvaluations: true })}
                    >
                      Reset usage
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[#9B9594]">No subscription row.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#2A2A2A] bg-[#141414]">
            <CardHeader>
              <CardTitle className="text-[#EAEAE8]">Recent evaluations</CardTitle>
            </CardHeader>
            <CardContent>
              {result.recentEvaluations && result.recentEvaluations.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {result.recentEvaluations.map((e) => (
                    <li key={e.id} className="rounded border border-[#2A2A2A] bg-[#1C1C1C] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-[#9B9594]">{e.id.slice(0, 8)}</span>
                        <span className="text-[#9B9594]">{e.mode}</span>
                        <span className={statusColor(e.status)}>{e.status}</span>
                        <span className="text-[#9B9594]">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      {e.error_message && (
                        <p className="mt-1 text-xs text-red-400">{e.error_message.slice(0, 200)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#9B9594]">No evaluations yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#9B9594]">{label}</span>
      <span className={mono ? "font-mono text-xs text-[#EAEAE8]" : "text-[#EAEAE8]"}>{value}</span>
    </div>
  );
}

function statusColor(status: string): string {
  if (status === "completed") return "text-emerald-400";
  if (status === "failed") return "text-red-400";
  return "text-amber-400";
}
