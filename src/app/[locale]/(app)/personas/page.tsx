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
          className="inline-block h-[4px] w-[4px] rounded-full bg-[#C4A882]"
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
  if (pending.status === "failed") {
    return (
      <div className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/[0.05] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
            <Sparkles className="h-5 w-5 text-[#F87171]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#EAEAE8]">{pending.name}</p>
            <p className="text-xs text-[#F87171]">
              Generation failed{pending.error ? `: ${pending.error}` : ""}
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
          "conic-gradient(from var(--border-angle), transparent 60%, #C4A882 100%)",
        animation: "border-rotate 2s linear infinite",
      }}
    >
      <div className="flex items-center gap-3 rounded-[11px] bg-[#141414] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
          <Sparkles className="h-5 w-5 text-[#C4A882]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#EAEAE8]">{pending.name}</p>
          <p className="text-xs text-[#666462]">Building personality, psychology, evaluation lens…</p>
        </div>
        <span className="flex items-center text-xs text-[#C4A882]">
          Generating
          <WaveDots />
        </span>
      </div>
    </div>
  );
}

export default function MyPersonasPage() {
  const locale = useLocale();
  const router = useRouter();
  const [personas, setPersonas] = useState<PersonaFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ type: DialogType; persona: PersonaFull } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
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
    setActionLoading(true);
    const res = await fetch(`/api/personas/${id}/publish`, { method: "POST" });
    if (res.ok) {
      setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: true } : p)));
    }
    setActionLoading(false);
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

  useEffect(() => {
    if (!menuOpenId) return;
    function close() { setMenuOpenId(null); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpenId]);

  const activePending = pendingJobs.filter((j) => j.status !== "completed");
  const isEmpty = personas.length === 0 && activePending.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
            My Personas
          </h1>
          <p className="mt-1 text-sm text-[#666462]">
            Custom personas for your round table discussions
          </p>
        </div>
        <Link
          href={`/${locale}/personas/create`}
          className="flex items-center gap-2 rounded-xl bg-[#C4A882] px-4 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#D4B892]"
        >
          <Plus className="h-4 w-4" />
          Create
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#666462]" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2A2A2A] py-16">
          <p className="mb-2 text-sm text-[#9B9594]">No custom personas yet</p>
          <p className="mb-6 text-xs text-[#666462]">
            Create one from scratch or import from an external source
          </p>
          <Link
            href={`/${locale}/personas/create`}
            className="flex items-center gap-2 rounded-lg bg-[#1C1C1C] px-4 py-2 text-sm text-[#EAEAE8] transition-colors hover:bg-[#222]"
          >
            <Plus className="h-4 w-4" />
            Create Persona
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
                className={`rounded-xl border bg-[#141414] transition-all duration-1000 ${
                  isHighlighted
                    ? "border-[#4ADE80] shadow-[0_0_16px_rgba(74,222,128,0.15)]"
                    : "border-[#2A2A2A] hover:border-[#333]"
                }`}
              >
                {/* Card header */}
                <div className="flex items-center px-5 py-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="flex items-center gap-4 min-w-0 flex-1 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
                      {p.identity.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[#EAEAE8]">
                          {p.identity.name}
                        </p>
                        {p.is_public && (
                          <span className="rounded bg-[#C4A882]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#C4A882]">
                            Published
                          </span>
                        )}
                        {p.source === "imported" && (
                          <span className="rounded bg-[#1C1C1C] px-1.5 py-0.5 text-[10px] text-[#9B9594]">
                            Imported
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-[#666462]">
                        {p.demographics.occupation}
                        {p.identity.tagline ? ` · ${p.identity.tagline}` : ""}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#666462] transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Three-dot menu */}
                  <div className="relative ml-2">
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === p.id ? null : p.id);
                      }}
                      className="rounded-lg p-1.5 text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === p.id && (
                      <div
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full z-40 mt-1 w-52 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] py-1 shadow-xl"
                      >
                        {p.is_public ? (
                          <button
                            onClick={() => { setMenuOpenId(null); setDialog({ type: "unpublish", persona: p }); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#9B9594] transition-colors hover:bg-[#252525] hover:text-[#EAEAE8]"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Unpublish
                          </button>
                        ) : (
                          <button
                            onClick={() => { setMenuOpenId(null); setDialog({ type: "publish", persona: p }); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#C4A882] transition-colors hover:bg-[#252525]"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Publish to Marketplace
                          </button>
                        )}
                        <button
                          onClick={() => { setMenuOpenId(null); router.push(`/${locale}/personas/${p.id}/edit`); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#9B9594] transition-colors hover:bg-[#252525] hover:text-[#EAEAE8]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <div className="my-1 border-t border-[#2A2A2A]" />
                        <button
                          onClick={() => { setMenuOpenId(null); setDialog({ type: "delete", persona: p }); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#F87171] transition-colors hover:bg-[#F87171]/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[#2A2A2A] px-5 py-5">
                    {/* Description & tags */}
                    {p.description && (
                      <p className="mb-4 text-sm text-[#9B9594]">{p.description}</p>
                    )}
                    {p.tags && p.tags.length > 0 && (
                      <div className="mb-5 flex flex-wrap gap-1.5">
                        {p.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-[#1C1C1C] px-2 py-0.5 text-xs text-[#9B9594]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Info sections */}
                    <div className="space-y-4">
                      {/* Demographics */}
                      <DetailSection icon={BookOpen} title="Demographics">
                        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                          {p.demographics.age && <DetailItem label="Age" value={p.demographics.age} />}
                          {p.demographics.gender && <DetailItem label="Gender" value={p.demographics.gender} />}
                          {p.demographics.location && <DetailItem label="Location" value={p.demographics.location} />}
                          {p.demographics.education && <DetailItem label="Education" value={p.demographics.education} />}
                          {p.demographics.income_level && <DetailItem label="Income" value={p.demographics.income_level} />}
                        </div>
                      </DetailSection>

                      {/* Psychology */}
                      {p.psychology && (
                        <DetailSection icon={Brain} title="Psychology">
                          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                            {p.psychology.personality_type && (
                              <DetailItem label="MBTI" value={p.psychology.personality_type} />
                            )}
                            {p.psychology.decision_making?.style && (
                              <DetailItem label="Decision Style" value={p.psychology.decision_making.style} />
                            )}
                            {p.psychology.risk_tolerance != null && (
                              <DetailItem label="Risk Tolerance" value={`${p.psychology.risk_tolerance}/10`} />
                            )}
                            {p.psychology.emotional_state?.motivation && (
                              <DetailItem label="Motivation" value={p.psychology.emotional_state.motivation} />
                            )}
                          </div>
                          {p.psychology.cognitive_biases && p.psychology.cognitive_biases.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-[#666462]">Biases: </span>
                              <span className="text-xs text-[#9B9594]">
                                {p.psychology.cognitive_biases.join(", ")}
                              </span>
                            </div>
                          )}
                        </DetailSection>
                      )}

                      {/* Evaluation Lens */}
                      {p.evaluation_lens && (
                        <DetailSection icon={Target} title="Evaluation Lens">
                          {p.evaluation_lens.primary_question && (
                            <p className="mb-2 text-xs italic text-[#C4A882]">
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
                                <span className="text-xs text-[#666462]">Blind spots: </span>
                                <span className="text-xs text-[#9B9594]">
                                  {p.evaluation_lens.blind_spots.join(", ")}
                                </span>
                              </div>
                            )}
                        </DetailSection>
                      )}

                      {/* Life Narrative */}
                      {p.life_narrative && (
                        <DetailSection icon={Heart} title="Life Narrative">
                          {p.life_narrative.origin_story && (
                            <p className="text-xs text-[#9B9594]">{p.life_narrative.origin_story}</p>
                          )}
                          {p.life_narrative.current_chapter && (
                            <DetailItem label="Current chapter" value={p.life_narrative.current_chapter} />
                          )}
                          {p.life_narrative.core_fear && (
                            <DetailItem label="Core fear" value={p.life_narrative.core_fear} />
                          )}
                        </DetailSection>
                      )}

                      {/* Latent Needs */}
                      {p.latent_needs && (
                        <DetailSection icon={AlertTriangle} title="Latent Needs">
                          <div className="space-y-1.5">
                            {p.latent_needs.stated_need && (
                              <DetailItem label="Stated need" value={p.latent_needs.stated_need} />
                            )}
                            {p.latent_needs.actual_need && (
                              <DetailItem label="Actual need" value={p.latent_needs.actual_need} />
                            )}
                            {p.latent_needs.emotional_need && (
                              <DetailItem label="Emotional need" value={p.latent_needs.emotional_need} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#EAEAE8]">
                {dialog.type === "publish" && "Publish to Marketplace"}
                {dialog.type === "unpublish" && "Unpublish from Marketplace"}
                {dialog.type === "delete" && "Delete Persona"}
              </h3>
              <button
                onClick={() => setDialog(null)}
                className="rounded-lg p-1 text-[#666462] transition-colors hover:text-[#EAEAE8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-base">
                {dialog.persona.identity.avatar}
              </div>
              <div>
                <p className="text-sm font-medium text-[#EAEAE8]">
                  {dialog.persona.identity.name}
                </p>
                <p className="text-xs text-[#666462]">
                  {dialog.persona.demographics.occupation}
                </p>
              </div>
            </div>

            <p className="mb-6 text-sm text-[#9B9594]">
              {dialog.type === "publish" &&
                "This persona will be visible to all users in the marketplace. You can unpublish it at any time."}
              {dialog.type === "unpublish" &&
                "This persona will be removed from the marketplace. Users who saved it will no longer see it."}
              {dialog.type === "delete" &&
                "This action cannot be undone. The persona will be permanently removed from your account."}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDialog(null)}
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-[#2A2A2A] px-4 py-2.5 text-sm text-[#9B9594] transition-colors hover:border-[#444] hover:text-[#EAEAE8] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (dialog.type === "publish") handlePublish(dialog.persona.id);
                  else if (dialog.type === "unpublish") handleUnpublish(dialog.persona.id);
                  else if (dialog.type === "delete") handleDelete(dialog.persona.id);
                }}
                disabled={actionLoading}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                  dialog.type === "delete"
                    ? "bg-[#F87171] text-white hover:bg-[#EF4444]"
                    : "bg-[#C4A882] text-[#0C0C0C] hover:bg-[#D4B892]"
                }`}
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {dialog.type === "publish" && "Publish"}
                {dialog.type === "unpublish" && "Unpublish"}
                {dialog.type === "delete" && "Delete"}
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
    <div className="rounded-lg bg-[#0C0C0C] border border-[#1C1C1C] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#C4A882]" />
        <span className="text-xs font-medium text-[#EAEAE8]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-xs text-[#666462]">{label}: </span>
      <span className="text-xs text-[#9B9594]">{String(value)}</span>
    </div>
  );
}
