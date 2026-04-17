import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  MessageCircle, Package, Scale, Sparkles, ArrowRight, Clock, CheckCircle2,
  AlertCircle, Loader2, Users, TrendingUp, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/plans";
import { PersonaAvatar } from "@/components/persona-avatar";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

type Mode = "topic" | "product";

interface EvaluationRow {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  mode: Mode;
  created_at: string;
  completed_at: string | null;
  selected_persona_ids: string[] | null;
  comparison_base_id: string | null;
  projects: { parsed_data: { name?: string } | null; raw_input: string } | null;
}

interface PersonaRow {
  id: string;
  identity: { name: string; avatar: string; locale_variants?: Record<string, { name: string }> };
  demographics: { occupation?: string };
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const zh = locale === "zh";
  if (diffMin < 1) return zh ? "刚刚" : "just now";
  if (diffMin < 60) return zh ? `${diffMin} 分钟前` : `${diffMin}m ago`;
  if (diffHour < 24) return zh ? `${diffHour} 小时前` : `${diffHour}h ago`;
  if (diffDay < 7) return zh ? `${diffDay} 天前` : `${diffDay}d ago`;
  return d.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function getEvaluationTitle(row: EvaluationRow): string {
  const name = row.projects?.parsed_data?.name;
  if (name && name.trim()) return name;
  const raw = row.projects?.raw_input ?? "";
  const firstLine = raw.split("\n")[0].trim();
  return firstLine.length > 70 ? firstLine.slice(0, 70) + "…" : firstLine || "—";
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const t = await getTranslations("dashboard");
  const zh = locale === "zh";

  // Parallel data fetch — keep off the waterfall.
  const [subRes, evalsRes, customCountRes, allTimeCountRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, evaluations_used, evaluations_limit, current_period_end, onboarding_completed_at")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("evaluations")
      .select(`
        id, status, mode, created_at, completed_at, selected_persona_ids, comparison_base_id,
        projects!inner(user_id, parsed_data, raw_input)
      `)
      .eq("projects.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("personas")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("is_active", true),
    supabase
      .from("evaluations")
      .select("id, projects!inner(user_id)", { count: "exact", head: true })
      .eq("projects.user_id", user.id),
  ]);

  const planKey = (subRes.data?.plan as keyof typeof PLANS) ?? "free";
  const planCfg = PLANS[planKey];
  const used = subRes.data?.evaluations_used ?? 0;
  const limit = subRes.data?.evaluations_limit ?? planCfg.evaluationsLimit;
  const periodEnd = subRes.data?.current_period_end ?? null;
  const remainingDays = periodEnd ? daysUntil(periodEnd) : null;
  const usagePct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const evaluations = ((evalsRes.data as unknown) as EvaluationRow[]) ?? [];
  const totalEvals = allTimeCountRes.count ?? 0;
  const topicCount = evaluations.filter((e) => e.mode === "topic" && !e.comparison_base_id).length;
  const productCount = evaluations.filter((e) => e.mode === "product" && !e.comparison_base_id).length;
  const compareCount = evaluations.filter((e) => !!e.comparison_base_id).length;
  const completedCount = evaluations.filter((e) => e.status === "completed").length;

  // Persona usage aggregation — top 5 across recent evaluations.
  const personaCounts = new Map<string, number>();
  for (const ev of evaluations) {
    if (ev.status !== "completed") continue;
    for (const pid of ev.selected_persona_ids ?? []) {
      personaCounts.set(pid, (personaCounts.get(pid) ?? 0) + 1);
    }
  }
  const topPersonaIds = Array.from(personaCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let topPersonas: Array<PersonaRow & { uses: number }> = [];
  if (topPersonaIds.length > 0) {
    const { data } = await supabase
      .from("personas")
      .select("id, identity, demographics")
      .in("id", topPersonaIds);
    const byId = new Map<string, PersonaRow>();
    for (const p of (data ?? []) as PersonaRow[]) byId.set(p.id, p);
    topPersonas = topPersonaIds
      .map((id) => {
        const p = byId.get(id);
        if (!p) return null;
        return { ...p, uses: personaCounts.get(id) ?? 0 };
      })
      .filter((x): x is PersonaRow & { uses: number } => x !== null);
  }

  const customUsed = customCountRes.count ?? 0;
  const customLimit = planCfg.customPersonasLimit;
  const recent = evaluations.slice(0, 6);

  const planLabel = zh
    ? { free: "免费版", pro: "Pro 版", max: "Max 版" }[planKey]
    : { free: "Free", pro: "Pro", max: "Max" }[planKey];

  const showOnboarding =
    subRes.data !== null && subRes.data?.onboarding_completed_at == null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      {showOnboarding && <OnboardingOverlay />}
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#666462]">
            {zh ? "欢迎回来" : "Welcome back"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
            {user.email?.split("@")[0] || (zh ? "用户" : "there")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
              planKey === "max"
                ? "border-[#C4A882] bg-[#C4A882]/10 text-[#D4B892]"
                : planKey === "pro"
                ? "border-[#E2DDD5]/40 bg-[#E2DDD5]/5 text-[#EAEAE8]"
                : "border-[#2A2A2A] bg-[#141414] text-[#9B9594]"
            }`}
          >
            {planKey !== "free" && <Sparkles className="h-3 w-3" />}
            {planLabel}
          </span>
          {planKey === "free" && (
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center gap-1 rounded-full bg-[#E2DDD5] px-3 py-1 text-xs font-semibold text-[#0C0C0C] hover:bg-[#D4CFC7] transition-colors"
            >
              <Zap className="h-3 w-3" />
              {zh ? "升级" : "Upgrade"}
            </Link>
          )}
        </div>
      </header>

      {/* Usage card */}
      <section className="mb-6 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#666462] uppercase tracking-wide">
              {zh ? "本周期使用情况" : "Usage this period"}
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#EAEAE8] tracking-tight">
              {used}
              <span className="text-base font-normal text-[#666462]"> / {limit}</span>
            </p>
            <p className="mt-1 text-xs text-[#9B9594]">
              {zh ? "讨论次数" : "discussions used"}
              {remainingDays !== null && (
                <span className="ml-2 text-[#666462]">
                  · {zh ? `${remainingDays} 天后重置` : `resets in ${remainingDays}d`}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/${locale}/evaluate/new?mode=topic`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#0C0C0C] px-3.5 py-2 text-xs font-medium text-[#9B9594] hover:border-[#3A3A3A] hover:text-[#EAEAE8] transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {zh ? "新话题" : "New Topic"}
            </Link>
            <Link
              href={`/${locale}/evaluate/new?mode=product`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#E2DDD5] px-3.5 py-2 text-xs font-semibold text-[#0C0C0C] hover:bg-[#D4CFC7] transition-colors"
            >
              <Package className="h-3.5 w-3.5" />
              {zh ? "新评估" : "New Evaluation"}
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0C0C0C]">
            <div
              className={`h-full rounded-full transition-all ${
                usagePct >= 90 ? "bg-[#F87171]" : usagePct >= 70 ? "bg-[#C4A882]" : "bg-[#E2DDD5]"
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={zh ? "累计讨论" : "Total discussions"}
          value={String(totalEvals)}
          sub={zh ? `${completedCount} 次已完成` : `${completedCount} completed`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label={zh ? "模式分布" : "Mode mix"}
          value={
            <span className="flex items-baseline gap-2 text-xl">
              <span className="text-[#EAEAE8]">{topicCount}</span>
              <span className="text-[#666462] text-xs">/</span>
              <span className="text-[#EAEAE8]">{productCount}</span>
              {compareCount > 0 && (
                <>
                  <span className="text-[#666462] text-xs">/</span>
                  <span className="text-[#EAEAE8]">{compareCount}</span>
                </>
              )}
            </span>
          }
          sub={
            compareCount > 0
              ? zh ? "话题 / 产品 / 对比" : "topic / product / compare"
              : zh ? "话题 / 产品" : "topic / product"
          }
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <StatCard
          label={zh ? "自定义 Persona" : "Custom personas"}
          value={customLimit < 0 ? `${customUsed} / ∞` : `${customUsed} / ${customLimit}`}
          sub={
            customLimit === 0
              ? zh ? "Pro 起解锁" : "Unlocks on Pro"
              : zh ? "已创建" : "created"
          }
          icon={<Users className="h-4 w-4" />}
        />
      </section>

      {/* Content grid */}
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent discussions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EAEAE8]">
              {zh ? "最近讨论" : "Recent discussions"}
            </h2>
            {recent.length > 0 && (
              <Link
                href={`/${locale}/evaluate/new`}
                className="text-xs text-[#9B9594] hover:text-[#EAEAE8] inline-flex items-center gap-1"
              >
                {zh ? "全部" : "View all"}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <EmptyState
              title={t("empty")}
              ctaHref={`/${locale}/evaluate/new?mode=topic`}
              ctaLabel={zh ? "开始第一次讨论" : "Start your first discussion"}
            />
          ) : (
            <ul className="space-y-2">
              {recent.map((ev) => (
                <RecentItem key={ev.id} ev={ev} locale={locale} />
              ))}
            </ul>
          )}
        </div>

        {/* Top personas */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EAEAE8]">
              {zh ? "常用 Persona" : "Top personas"}
            </h2>
            <Link
              href={`/${locale}/marketplace`}
              className="text-xs text-[#9B9594] hover:text-[#EAEAE8] inline-flex items-center gap-1"
            >
              {zh ? "市场" : "Marketplace"}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {topPersonas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A2A2A] bg-[#141414]/40 px-4 py-8 text-center">
              <p className="text-xs text-[#666462]">
                {zh ? "完成一次讨论后即可看到常用的 Persona" : "Top personas appear after your first discussion."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {topPersonas.map((p) => {
                const localized = p.identity.locale_variants?.[locale] ?? p.identity.locale_variants?.en;
                const displayName = localized?.name ?? p.identity.name;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2.5"
                  >
                    <PersonaAvatar avatar={p.identity.avatar} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#EAEAE8]">{displayName}</p>
                      <p className="truncate text-[11px] text-[#666462]">
                        {p.demographics?.occupation ?? ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#0C0C0C] border border-[#2A2A2A] px-2 py-0.5 text-[10px] font-medium text-[#9B9594]">
                      ×{p.uses}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
      <div className="flex items-center justify-between text-[#666462]">
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-[#EAEAE8] tracking-tight">
        {value}
      </div>
      <p className="mt-0.5 text-[11px] text-[#666462]">{sub}</p>
    </div>
  );
}

function RecentItem({ ev, locale }: { ev: EvaluationRow; locale: string }) {
  const zh = locale === "zh";
  const title = getEvaluationTitle(ev);
  const isCompare = !!ev.comparison_base_id;
  const Icon = isCompare ? Scale : ev.mode === "product" ? Package : MessageCircle;

  const statusMeta =
    ev.status === "completed"
      ? { label: zh ? "已完成" : "Completed", icon: CheckCircle2, color: "text-[#86EFAC]" }
      : ev.status === "processing"
      ? { label: zh ? "处理中" : "Processing", icon: Loader2, color: "text-[#C4A882] animate-spin" }
      : ev.status === "failed"
      ? { label: zh ? "失败" : "Failed", icon: AlertCircle, color: "text-[#F87171]" }
      : { label: zh ? "待处理" : "Pending", icon: Clock, color: "text-[#9B9594]" };

  const StatusIcon = statusMeta.icon;
  const href =
    ev.status === "completed"
      ? `/${locale}/evaluate/${ev.id}/result`
      : `/${locale}/evaluate/${ev.id}/progress`;

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3 transition-colors hover:border-[#3A3A3A] hover:bg-[#1A1A1A]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0C0C0C] text-[#9B9594]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#EAEAE8]">{title}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#666462]">
            <span className={`inline-flex items-center gap-1 ${statusMeta.color}`}>
              <StatusIcon className={`h-3 w-3 ${ev.status === "processing" ? "animate-spin" : ""}`} />
              {statusMeta.label}
            </span>
            <span>·</span>
            <span>{formatDate(ev.created_at, locale)}</span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-[#666462]" />
      </Link>
    </li>
  );
}

function EmptyState({
  title,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#2A2A2A] bg-[#141414]/40 px-6 py-10 text-center">
      <p className="text-sm text-[#9B9594]">{title}</p>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#E2DDD5] px-4 py-2 text-xs font-semibold text-[#0C0C0C] hover:bg-[#D4CFC7] transition-colors"
      >
        {ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
