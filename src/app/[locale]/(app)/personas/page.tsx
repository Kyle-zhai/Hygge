"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Globe,
  Loader2,
  Trash2,
  ChevronDown,
  X,
  Brain,
  Target,
  Heart,
  BookOpen,
  AlertTriangle,
  Sparkles,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { PersonaAvatar } from "@/components/persona-avatar";
import {
  KIND_LABEL,
  topicSubOptionsByDomain,
  productOptions,
  type MarketplaceKind,
} from "@/lib/personas/marketplace-taxonomy";

const SCENARIOS = [
  { value: "product_evaluation", label: "Product Evaluation", label_zh: "产品评估" },
  { value: "market_research", label: "Market Research", label_zh: "市场调研" },
  { value: "user_testing", label: "User Testing", label_zh: "用户测试" },
  { value: "design_review", label: "Design Review", label_zh: "设计评审" },
  { value: "business_strategy", label: "Business Strategy", label_zh: "商业策略" },
  { value: "competitive_analysis", label: "Competitive Analysis", label_zh: "竞品分析" },
  { value: "content_review", label: "Content Review", label_zh: "内容评审" },
  { value: "policy_discussion", label: "Policy Discussion", label_zh: "政策讨论" },
  { value: "brainstorming", label: "Brainstorming", label_zh: "头脑风暴" },
  { value: "decision_making", label: "Decision Making", label_zh: "决策支持" },
];

interface PersonaFull {
  id: string;
  identity: { name: string; avatar: string; tagline: string };
  demographics: {
    age?: number;
    gender?: string;
    location?: string;
    education?: string;
    occupation: string;
    income_level?: string;
  };
  psychology?: {
    personality_type?: string;
    decision_making?: { style?: string; persuadability?: number };
    cognitive_biases?: string[];
    emotional_state?: { baseline?: string; motivation?: string };
    risk_tolerance?: number;
  };
  evaluation_lens?: {
    primary_question?: string;
    scoring_weights?: Record<string, number>;
    known_biases?: string[];
    blind_spots?: string[];
  };
  life_narrative?: {
    origin_story?: string;
    current_chapter?: string;
    core_fear?: string;
  };
  latent_needs?: {
    stated_need?: string;
    actual_need?: string;
    emotional_need?: string;
  };
  behaviors?: {
    daily_habits?: string[];
    product_evaluation?: {
      deal_breakers?: string[];
      delighters?: string[];
    };
  };
  description?: string;
  tags?: string[];
  is_public?: boolean;
  source?: string;
}

interface PendingPersona {
  jobId: string;
  name: string;
  createdAt: number;
  status: "processing" | "completed" | "failed";
  error?: string;
  personaId?: string;
}

type DialogType = "publish" | "unpublish" | "delete" | null;

function WaveDots() {
  return (
    <span className="inline-flex items-center gap-[2px] ml-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[4px] w-[4px] rounded-full bg-[color:var(--accent-warm)]"
          style={{
            animation: "wave-bounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

function GeneratingCard({ pending }: { pending: PendingPersona }) {
  const locale = useLocale();
  const zh = locale === "zh";
  if (pending.status === "failed") {
    return (
      <div className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/[0.05] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-tertiary)] text-lg">
            <Sparkles className="h-5 w-5 text-[#F87171]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">{pending.name}</p>
            <p className="text-xs text-[#F87171]">
              {zh ? "生成失败" : "Generation failed"}
              {pending.error ? `: ${pending.error}` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-[1px]"
      style={{
        background:
          "conic-gradient(from var(--border-angle), transparent 60%, var(--accent-warm) 100%)",
        animation: "border-rotate 2s linear infinite",
      }}
    >
      <div className="flex items-center gap-3 rounded-[11px] bg-[color:var(--bg-secondary)] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-tertiary)] text-lg">
          <Sparkles className="h-5 w-5 text-[color:var(--accent-warm)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[color:var(--text-primary)]">{pending.name}</p>
          <p className="text-xs text-[color:var(--text-tertiary)]">
            {zh
              ? "正在生成人格、心理画像、评估视角…"
              : "Building personality, psychology, evaluation lens…"}
          </p>
        </div>
        <span className="flex items-center text-xs text-[color:var(--accent-warm)]">
          {zh ? "生成中" : "Generating"}
          <WaveDots />
        </span>
      </div>
    </div>
  );
}

export default function MyPersonasPage() {
  const locale = useLocale();
  const zh = locale === "zh";
  const router = useRouter();
  const [personas, setPersonas] = useState<PersonaFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ type: DialogType; persona: PersonaFull } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [publishDesc, setPublishDesc] = useState("");
  const [publishKind, setPublishKind] = useState<MarketplaceKind | "">("");
  const [publishSubDomain, setPublishSubDomain] = useState("");
  const [publishProductCategory, setPublishProductCategory] = useState("");
  const [publishTags, setPublishTags] = useState<string[]>([]);
  const [publishTagInput, setPublishTagInput] = useState("");
  const [publishScenarios, setPublishScenarios] = useState<string[]>([]);
  const [pendingJobs, setPendingJobs] = useState<PendingPersona[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPersonas = useCallback(async () => {
    const res = await fetch("/api/personas/mine");
    const data = await res.json();
    setPersonas(data.personas ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch; setState is intentional and gated by a pending-fetch flag inside fetchPersonas
    fetchPersonas().finally(() => setLoading(false));
  }, [fetchPersonas]);

  useEffect(() => {
    const raw = localStorage.getItem("pendingPersonas");
    if (!raw) return;
    try {
      const stored: PendingPersona[] = JSON.parse(raw);
      const recent = stored.filter(
        (p) => Date.now() - p.createdAt < 10 * 60 * 1000
      );
      if (recent.length !== stored.length) {
        localStorage.setItem("pendingPersonas", JSON.stringify(recent));
      }
      if (recent.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- rehydrating pendingJobs from localStorage on mount; only runs once, guarded by the empty dep array
        setPendingJobs(recent.map((p) => ({ ...p, status: p.status ?? "processing" })));
      }
    } catch {
      localStorage.removeItem("pendingPersonas");
    }
  }, []);

  useEffect(() => {
    const active = pendingJobs.filter((j) => j.status === "processing");
    if (active.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    async function pollJobs() {
      const active = pendingJobs.filter((j) => j.status === "processing");
      let changed = false;
      const newHighlights: string[] = [];

      const updated = await Promise.all(
        active.map(async (job) => {
          try {
            const res = await fetch(`/api/personas/create/status/${job.jobId}`);
            const data = await res.json();
            if (data.status === "completed") {
              changed = true;
              const pid = data.persona?.id;
              if (pid) newHighlights.push(pid);
              return { ...job, status: "completed" as const, personaId: pid };
            }
            if (data.status === "failed") {
              changed = true;
              return { ...job, status: "failed" as const, error: data.error };
            }
          } catch {}
          return job;
        })
      );

      if (changed) {
        setPendingJobs((prev) => {
          const next = prev.map((p) => {
            const match = updated.find((u) => u.jobId === p.jobId);
            return match ?? p;
          });
          const stillPending = next.filter((j) => j.status === "processing");
          localStorage.setItem("pendingPersonas", JSON.stringify(stillPending));
          return next;
        });
        await fetchPersonas();
        if (newHighlights.length > 0) {
          setHighlightIds(new Set(newHighlights));
          setTimeout(() => setHighlightIds(new Set()), 3000);
        }
      }
    }

    pollJobs();
    pollRef.current = setInterval(pollJobs, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pendingJobs, fetchPersonas]);

  async function handlePublish(id: string) {
    if (!publishKind) return;
    setActionLoading(true);
    const payload: Record<string, unknown> = {
      description: publishDesc,
      tags: publishTags,
      scenarios: publishScenarios,
      kind: publishKind,
    };
    if (publishKind === "topic") payload.sub_domain = publishSubDomain;
    if (publishKind === "product") payload.product_category = publishProductCategory;
    const res = await fetch(`/api/personas/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: true, description: publishDesc || p.description, tags: publishTags } : p)));
    }
    setActionLoading(false);
    setPublishDesc("");
    setPublishKind("");
    setPublishSubDomain("");
    setPublishProductCategory("");
    setPublishTags([]);
    setPublishTagInput("");
    setPublishScenarios([]);
    setDialog(null);
  }

  async function handleUnpublish(id: string) {
    setActionLoading(true);
    const res = await fetch(`/api/personas/${id}/publish`, { method: "DELETE" });
    if (res.ok) {
      setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: false } : p)));
    }
    setActionLoading(false);
    setDialog(null);
  }

  async function handleDelete(id: string) {
    setActionLoading(true);
    const res = await fetch(`/api/personas/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPersonas((prev) => prev.filter((p) => p.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
    setActionLoading(false);
    setDialog(null);
  }

  const activePending = pendingJobs.filter((j) => j.status !== "completed");
  const isEmpty = personas.length === 0 && activePending.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[color:var(--text-primary)] tracking-[-0.02em]">
            {zh ? "我的人格" : "My Personas"}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--text-tertiary)]">
            {zh
              ? "为你的圆桌讨论准备的自定义人格"
              : "Custom personas for your round table discussions"}
          </p>
        </div>
        <Link
          href={`/${locale}/personas/create`}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-[color:var(--accent-warm)] px-3 py-2.5 text-sm font-semibold text-[color:var(--bg-primary)] transition-colors hover:bg-[color:var(--accent-warm-hover)] sm:px-4"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{zh ? "创建" : "Create"}</span>
        </Link>
      </div>

      {menuOpenId && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--text-tertiary)]" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--border-default)] px-4 py-16 text-center">
          <p className="mb-2 text-sm text-[color:var(--text-secondary)]">
            {zh ? "尚无自定义人格" : "No custom personas yet"}
          </p>
          <p className="mb-6 text-xs text-[color:var(--text-tertiary)]">
            {zh
              ? "从零开始创建，或从外部来源导入"
              : "Create one from scratch or import from an external source"}
          </p>
          <Link
            href={`/${locale}/personas/create`}
            className="flex items-center gap-2 rounded-lg bg-[color:var(--bg-tertiary)] px-4 py-2 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[#222]"
          >
            <Plus className="h-4 w-4" />
            {zh ? "创建人格" : "Create Persona"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activePending.map((job) => (
            <GeneratingCard key={job.jobId} pending={job} />
          ))}

          {personas.map((p) => {
            const isExpanded = expandedId === p.id;
            const isHighlighted = highlightIds.has(p.id);
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-[color:var(--bg-secondary)] transition-all duration-1000 ${
                  isHighlighted
                    ? "border-[#4ADE80] shadow-[0_0_16px_rgba(74,222,128,0.15)]"
                    : "border-[color:var(--border-default)] hover:border-[#333]"
                }`}
              >
                {/* Card header */}
                <div className="flex items-center px-5 py-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="flex items-center gap-4 min-w-0 flex-1 text-left"
                  >
                    <PersonaAvatar avatar={p.identity.avatar} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                          {p.identity.name}
                        </p>
                        {p.is_public && (
                          <span className="rounded bg-[rgb(var(--accent-warm-rgb)/0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--accent-warm)]">
                            {zh ? "已发布" : "Published"}
                          </span>
                        )}
                        {p.source === "imported" && (
                          <span className="rounded bg-[color:var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
                            {zh ? "已导入" : "Imported"}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-[color:var(--text-tertiary)]">
                        {p.demographics.occupation}
                        {p.identity.tagline ? ` · ${p.identity.tagline}` : ""}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[color:var(--text-tertiary)] transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Three-dot menu */}
                  <div className="relative ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === p.id ? null : p.id);
                      }}
                      className="rounded-lg p-1.5 text-[color:var(--text-tertiary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === p.id && (
                      <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] py-1 shadow-xl">
                        {p.is_public ? (
                          <button
                            onClick={() => { setMenuOpenId(null); setDialog({ type: "unpublish", persona: p }); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[color:var(--text-secondary)] transition-colors hover:bg-[#252525] hover:text-[color:var(--text-primary)]"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            {zh ? "取消发布" : "Unpublish"}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setMenuOpenId(null); setPublishDesc(p.description ?? ""); setPublishKind(""); setPublishSubDomain(""); setPublishProductCategory(""); setDialog({ type: "publish", persona: p }); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[color:var(--accent-warm)] transition-colors hover:bg-[#252525]"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            {zh ? "发布到市场" : "Publish to Marketplace"}
                          </button>
                        )}
                        <button
                          onClick={() => { setMenuOpenId(null); router.push(`/${locale}/personas/${p.id}/edit`); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[color:var(--text-secondary)] transition-colors hover:bg-[#252525] hover:text-[color:var(--text-primary)]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {zh ? "编辑" : "Edit"}
                        </button>
                        <div className="my-1 border-t border-[color:var(--border-default)]" />
                        <button
                          onClick={() => { setMenuOpenId(null); setDialog({ type: "delete", persona: p }); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#F87171] transition-colors hover:bg-[#F87171]/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {zh ? "删除" : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[color:var(--border-default)] px-5 py-5">
                    {/* Description & tags */}
                    {p.description && (
                      <p className="mb-4 text-sm text-[color:var(--text-secondary)]">{p.description}</p>
                    )}
                    {p.tags && p.tags.length > 0 && (
                      <div className="mb-5 flex flex-wrap gap-1.5">
                        {p.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-xs text-[color:var(--text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Info sections */}
                    <div className="space-y-4">
                      {/* Demographics */}
                      <DetailSection icon={BookOpen} title={zh ? "人口画像" : "Demographics"}>
                        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                          {p.demographics.age && <DetailItem label={zh ? "年龄" : "Age"} value={p.demographics.age} />}
                          {p.demographics.gender && <DetailItem label={zh ? "性别" : "Gender"} value={p.demographics.gender} />}
                          {p.demographics.location && <DetailItem label={zh ? "所在地" : "Location"} value={p.demographics.location} />}
                          {p.demographics.education && <DetailItem label={zh ? "学历" : "Education"} value={p.demographics.education} />}
                          {p.demographics.income_level && <DetailItem label={zh ? "收入" : "Income"} value={p.demographics.income_level} />}
                        </div>
                      </DetailSection>

                      {/* Psychology */}
                      {p.psychology && (
                        <DetailSection icon={Brain} title={zh ? "心理画像" : "Psychology"}>
                          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                            {p.psychology.personality_type && (
                              <DetailItem label="MBTI" value={p.psychology.personality_type} />
                            )}
                            {p.psychology.decision_making?.style && (
                              <DetailItem label={zh ? "决策风格" : "Decision Style"} value={p.psychology.decision_making.style} />
                            )}
                            {p.psychology.risk_tolerance != null && (
                              <DetailItem label={zh ? "风险偏好" : "Risk Tolerance"} value={`${p.psychology.risk_tolerance}/10`} />
                            )}
                            {p.psychology.emotional_state?.motivation && (
                              <DetailItem label={zh ? "核心动机" : "Motivation"} value={p.psychology.emotional_state.motivation} />
                            )}
                          </div>
                          {p.psychology.cognitive_biases && p.psychology.cognitive_biases.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-[color:var(--text-tertiary)]">{zh ? "认知偏差：" : "Biases: "}</span>
                              <span className="text-xs text-[color:var(--text-secondary)]">
                                {p.psychology.cognitive_biases.join(zh ? "、" : ", ")}
                              </span>
                            </div>
                          )}
                        </DetailSection>
                      )}

                      {/* Evaluation Lens */}
                      {p.evaluation_lens && (
                        <DetailSection icon={Target} title={zh ? "评估视角" : "Evaluation Lens"}>
                          {p.evaluation_lens.primary_question && (
                            <p className="mb-2 text-xs italic text-[color:var(--accent-warm)]">
                              &ldquo;{p.evaluation_lens.primary_question}&rdquo;
                            </p>
                          )}
                          {p.evaluation_lens.scoring_weights && (
                            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
                              {Object.entries(p.evaluation_lens.scoring_weights).map(
                                ([k, v]) => (
                                  <DetailItem key={k} label={k} value={`${v}/10`} />
                                )
                              )}
                            </div>
                          )}
                          {p.evaluation_lens.blind_spots &&
                            p.evaluation_lens.blind_spots.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs text-[color:var(--text-tertiary)]">{zh ? "盲点：" : "Blind spots: "}</span>
                                <span className="text-xs text-[color:var(--text-secondary)]">
                                  {p.evaluation_lens.blind_spots.join(zh ? "、" : ", ")}
                                </span>
                              </div>
                            )}
                        </DetailSection>
                      )}

                      {/* Life Narrative */}
                      {p.life_narrative && (
                        <DetailSection icon={Heart} title={zh ? "人生叙事" : "Life Narrative"}>
                          {p.life_narrative.origin_story && (
                            <p className="text-xs text-[color:var(--text-secondary)]">{p.life_narrative.origin_story}</p>
                          )}
                          {p.life_narrative.current_chapter && (
                            <DetailItem label={zh ? "当前阶段" : "Current chapter"} value={p.life_narrative.current_chapter} />
                          )}
                          {p.life_narrative.core_fear && (
                            <DetailItem label={zh ? "核心恐惧" : "Core fear"} value={p.life_narrative.core_fear} />
                          )}
                        </DetailSection>
                      )}

                      {/* Latent Needs */}
                      {p.latent_needs && (
                        <DetailSection icon={AlertTriangle} title={zh ? "潜在需求" : "Latent Needs"}>
                          <div className="space-y-1.5">
                            {p.latent_needs.stated_need && (
                              <DetailItem label={zh ? "表面需求" : "Stated need"} value={p.latent_needs.stated_need} />
                            )}
                            {p.latent_needs.actual_need && (
                              <DetailItem label={zh ? "真实需求" : "Actual need"} value={p.latent_needs.actual_need} />
                            )}
                            {p.latent_needs.emotional_need && (
                              <DetailItem label={zh ? "情感需求" : "Emotional need"} value={p.latent_needs.emotional_need} />
                            )}
                          </div>
                        </DetailSection>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
                {dialog.type === "publish" && (zh ? "发布到市场" : "Publish to Marketplace")}
                {dialog.type === "unpublish" && (zh ? "从市场下架" : "Unpublish from Marketplace")}
                {dialog.type === "delete" && (zh ? "删除人格" : "Delete Persona")}
              </h3>
              <button
                onClick={() => setDialog(null)}
                className="rounded-lg p-1 text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 flex items-center gap-3">
              <PersonaAvatar avatar={dialog.persona.identity.avatar} size={36} />
              <div>
                <p className="text-sm font-medium text-[color:var(--text-primary)]">
                  {dialog.persona.identity.name}
                </p>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  {dialog.persona.demographics.occupation}
                </p>
              </div>
            </div>

            {dialog.type === "publish" && (
              <div className="mb-5 space-y-4">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {zh
                    ? "发布后所有用户都可在市场看到这个人格。"
                    : "This persona will be visible to all users in the marketplace."}
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--text-primary)]">
                    {zh ? "分类" : "Kind"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["topic", "product", "general"] as MarketplaceKind[]).map((k) => {
                      const active = publishKind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setPublishKind(k);
                            setPublishSubDomain("");
                            setPublishProductCategory("");
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                            active
                              ? "border-[rgb(var(--accent-warm-rgb)/0.60)] bg-[rgb(var(--accent-warm-rgb)/0.10)] text-[color:var(--text-primary)]"
                              : "border-[color:var(--border-default)] bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] hover:border-[#444] hover:text-[color:var(--text-primary)]"
                          }`}
                        >
                          {zh ? KIND_LABEL[k].zh : KIND_LABEL[k].en}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {publishKind === "topic" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[color:var(--text-primary)]">
                      {zh ? "子领域" : "Sub-domain"}
                    </label>
                    <select
                      value={publishSubDomain}
                      onChange={(e) => setPublishSubDomain(e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors focus:border-[rgb(var(--accent-warm-rgb)/0.50)]"
                    >
                      <option value="">{zh ? "选择子领域" : "Select a sub-domain"}</option>
                      {topicSubOptionsByDomain().map((g) => (
                        <optgroup key={g.domain} label={zh ? g.label_zh : g.label_en}>
                          {g.subs.map((s) => (
                            <option key={s.value} value={s.value}>{zh ? s.label_zh : s.label_en}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}
                {publishKind === "product" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[color:var(--text-primary)]">
                      {zh ? "产品类别" : "Product category"}
                    </label>
                    <select
                      value={publishProductCategory}
                      onChange={(e) => setPublishProductCategory(e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors focus:border-[rgb(var(--accent-warm-rgb)/0.50)]"
                    >
                      <option value="">{zh ? "选择产品类别" : "Select a product category"}</option>
                      {productOptions().map((o) => (
                        <option key={o.value} value={o.value}>{zh ? o.label_zh : o.label_en}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--text-primary)]">
                    {zh ? "简介" : "Introduction"}
                  </label>
                  <textarea
                    value={publishDesc}
                    onChange={(e) => setPublishDesc(e.target.value)}
                    onWheel={(e) => {
                      const el = e.currentTarget;
                      el.scrollTop += e.deltaY;
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    placeholder={zh ? "为市场用户描述这个人格..." : "Describe this persona for marketplace users..."}
                    rows={3}
                    className="scrollbar-sidebar w-full max-h-40 overscroll-contain rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[#444] outline-none transition-colors focus:border-[rgb(var(--accent-warm-rgb)/0.50)] resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--text-primary)]">
                    {zh ? "适用场景" : "Scenarios"}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SCENARIOS.map((s) => {
                      const active = publishScenarios.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() =>
                            setPublishScenarios((prev) =>
                              active ? prev.filter((v) => v !== s.value) : [...prev, s.value]
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "bg-[rgb(var(--accent-warm-rgb)/0.20)] text-[color:var(--accent-warm)] ring-1 ring-[rgb(var(--accent-warm-rgb)/0.30)]"
                              : "bg-[color:var(--bg-tertiary)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                          }`}
                        >
                          {zh ? s.label_zh : s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--text-primary)]">
                    {zh ? "标签" : "Tags"}
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-2.5 py-2 min-h-[36px]">
                    {publishTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[color:var(--text-secondary)]"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setPublishTags((prev) => prev.filter((t) => t !== tag))}
                          className="text-[color:var(--text-tertiary)] hover:text-[#F87171]"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={publishTagInput}
                      onChange={(e) => setPublishTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if ((e.key === "Enter" || e.key === ",") && publishTagInput.trim()) {
                          e.preventDefault();
                          const tag = publishTagInput.trim().replace(/,$/,"");
                          if (tag && !publishTags.includes(tag)) {
                            setPublishTags((prev) => [...prev, tag]);
                          }
                          setPublishTagInput("");
                        }
                        if (e.key === "Backspace" && !publishTagInput && publishTags.length > 0) {
                          setPublishTags((prev) => prev.slice(0, -1));
                        }
                      }}
                      placeholder={
                        publishTags.length === 0
                          ? zh
                            ? "输入后按回车..."
                            : "Type and press Enter..."
                          : ""
                      }
                      className="min-w-[80px] flex-1 bg-transparent text-xs text-[color:var(--text-primary)] placeholder:text-[#444] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
            {dialog.type === "unpublish" && (
              <p className="mb-6 text-sm text-[color:var(--text-secondary)]">
                {zh
                  ? "该人格将从市场移除，已收藏它的用户也将无法看到。"
                  : "This persona will be removed from the marketplace. Users who saved it will no longer see it."}
              </p>
            )}
            {dialog.type === "delete" && (
              <p className="mb-6 text-sm text-[color:var(--text-secondary)]">
                {zh
                  ? "此操作不可撤销。该人格将从你的账号中永久移除。"
                  : "This action cannot be undone. The persona will be permanently removed from your account."}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDialog(null); setPublishDesc(""); setPublishKind(""); setPublishSubDomain(""); setPublishProductCategory(""); setPublishTags([]); setPublishTagInput(""); setPublishScenarios([]); }}
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-[color:var(--border-default)] px-4 py-2.5 text-sm text-[color:var(--text-secondary)] transition-colors hover:border-[#444] hover:text-[color:var(--text-primary)] disabled:opacity-40"
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  if (dialog.type === "publish") handlePublish(dialog.persona.id);
                  else if (dialog.type === "unpublish") handleUnpublish(dialog.persona.id);
                  else if (dialog.type === "delete") handleDelete(dialog.persona.id);
                }}
                disabled={actionLoading || (dialog.type === "publish" && (
                  !publishKind ||
                  !publishDesc.trim() ||
                  (publishKind === "topic" && !publishSubDomain) ||
                  (publishKind === "product" && !publishProductCategory)
                ))}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                  dialog.type === "delete"
                    ? "bg-[#F87171] text-white hover:bg-[#EF4444]"
                    : "bg-[color:var(--accent-warm)] text-[color:var(--bg-primary)] hover:bg-[color:var(--accent-warm-hover)]"
                }`}
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {dialog.type === "publish" && (zh ? "发布" : "Publish")}
                {dialog.type === "unpublish" && (zh ? "下架" : "Unpublish")}
                {dialog.type === "delete" && (zh ? "删除" : "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-[color:var(--bg-primary)] border border-[color:var(--bg-tertiary)] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[color:var(--accent-warm)]" />
        <span className="text-xs font-medium text-[color:var(--text-primary)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-xs text-[color:var(--text-tertiary)]">{label}: </span>
      <span className="text-xs text-[color:var(--text-secondary)]">{String(value)}</span>
    </div>
  );
}
