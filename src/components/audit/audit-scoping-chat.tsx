"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  MessageCircleQuestion,
  ScanSearch,
  Send,
} from "lucide-react";

type ScopingStatus =
  | "created"
  | "annotating"
  | "scoping"
  | "awaiting_user"
  | "scope_locked"
  | "failed";

interface PendingQuestion {
  id: string;
  text: string;
  context: string;
  answer_format: "yes_no" | "single_select" | "free_text";
  options: string[] | null;
  asked_at_passage_idx: number;
}

interface ConversationTurn {
  role: "system" | "user";
  kind: "question" | "answer" | "scope_update" | "note";
  text: string;
  ts?: string;
  refs?: { passage_idx?: number; law_id?: string; question_id?: string };
}

interface ScopedLaw {
  law_id: string;
  status: "in" | "out";
  reason: string;
  passage_refs: number[];
}

interface ScopingRow {
  id: string;
  audit_session_id: string;
  status: ScopingStatus;
  passages: Array<{ idx: number; text: string; annotations: string[] }>;
  cursor: number;
  conversation: ConversationTurn[];
  pending_question: PendingQuestion | null;
  scope_in: ScopedLaw[];
  scope_out: ScopedLaw[];
  question_count: number;
  max_questions: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  scope_locked_at: string | null;
}

interface LawCatalogEntry {
  id: string;
  name_en: string;
  name_zh: string;
  jurisdiction: string;
}

interface Props {
  scopingId: string;
  auditSessionId: string;
  initial: ScopingRow;
  lawCatalog: LawCatalogEntry[];
  locale: string;
}

const TERMINAL_STATES = new Set<ScopingStatus>(["scope_locked", "failed"]);
const POLL_INTERVAL_MS = 2000;

export function AuditScopingChat({
  scopingId,
  auditSessionId,
  initial,
  lawCatalog: initialLawCatalog,
  locale,
}: Props) {
  const t = useTranslations("audit");
  const router = useRouter();
  const [row, setRow] = useState<ScopingRow>(initial);
  const [lawCatalog, setLawCatalog] = useState<LawCatalogEntry[]>(initialLawCatalog);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lawCatalogMap = useMemo(() => {
    const map = new Map<string, LawCatalogEntry>();
    for (const law of lawCatalog) map.set(law.id, law);
    return map;
  }, [lawCatalog]);

  // Poll while non-terminal and no pending question.
  useEffect(() => {
    if (TERMINAL_STATES.has(row.status)) return;
    if (row.status === "awaiting_user") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/audit/scoping/${scopingId}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as ScopingRow;
        if (cancelled) return;
        setRow(next);

        // If scope_in/scope_out grew with new law_ids, refresh the catalog.
        const referenced = new Set<string>([
          ...next.scope_in.map((s) => s.law_id),
          ...next.scope_out.map((s) => s.law_id),
        ]);
        const known = new Set(lawCatalog.map((l) => l.id));
        const missing = [...referenced].filter((id) => !known.has(id));
        if (missing.length > 0) {
          // No public law-catalog endpoint yet, but the worker only emits law_ids
          // that exist in the catalog. Fall back to displaying the raw id.
          // This is a best-effort enhancement and not blocking.
          setLawCatalog((prev) => prev);
        }
      } catch {
        // Silent — next tick will retry.
      }
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [scopingId, row.status, lawCatalog]);

  // Auto-scroll on conversation changes.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [row.conversation.length, row.pending_question?.id]);

  async function submitAnswer(answer: string) {
    setError(null);
    try {
      const res = await fetch(`/api/audit/scoping/${scopingId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, reply_language: locale === "zh" ? "zh" : "en" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "respond_failed");
      }
      const next = (await res.json()).scoping as ScopingRow | undefined;
      if (next) setRow(next);
      else {
        // Fallback: refetch.
        const refreshed = await fetch(`/api/audit/scoping/${scopingId}`, { cache: "no-store" });
        if (refreshed.ok) setRow(await refreshed.json());
      }
    } catch (err) {
      console.error(err);
      setError(t("scopingErrorAnswer"));
    }
  }

  async function finalize(force: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/audit/scoping/${scopingId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) throw new Error("pending");
        throw new Error(body?.error ?? "finalize_failed");
      }
      const next = (await res.json()).scoping as ScopingRow | undefined;
      if (next) setRow(next);
      startTransition(() => {
        router.push(`/${locale}/audit/${auditSessionId}`);
      });
    } catch (err) {
      const msg = err instanceof Error && err.message === "pending"
        ? t("scopingErrorPendingQuestion")
        : t("scopingErrorFinalize");
      setError(msg);
    }
  }

  const passageTotal = row.passages.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <ScopingProgress
          status={row.status}
          cursor={row.cursor}
          passageTotal={passageTotal}
          questionCount={row.question_count}
          maxQuestions={row.max_questions}
        />

        <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-5">
          <ConversationFeed
            conversation={row.conversation}
            pendingQuestion={row.pending_question}
            status={row.status}
          />
          <div ref={messagesEndRef} />
        </div>

        {row.status === "awaiting_user" && row.pending_question && (
          <ScopingAnswerInput
            question={row.pending_question}
            onSubmit={submitAnswer}
          />
        )}

        {row.status === "scope_locked" && (
          <div className="rounded-xl border border-[color:var(--accent-warm)]/40 bg-[rgb(var(--accent-warm-rgb)/0.08)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-warm)]" />
              <span className="text-sm font-medium text-[color:var(--text-primary)]">
                {t("scopingStatusScopeLocked")}
              </span>
            </div>
            <p className="text-sm text-[color:var(--text-tertiary)] leading-relaxed mb-4">
              {t("scopingProceedHint")}
            </p>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/audit/${auditSessionId}`)}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--text-primary)] px-5 py-2 text-sm font-medium text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5"
            >
              {t("scopingBackToAudit")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {row.status === "failed" && (
          <div className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 p-5">
            <div className="flex items-center gap-2 mb-2">
              <CircleAlert className="h-4 w-4 text-[#F87171]" />
              <span className="text-sm font-medium text-[#F87171]">
                {t("scopingStatusFailed")}
              </span>
            </div>
            <p className="text-sm text-[#F87171]/80 leading-relaxed">
              {row.error_message || t("scopingFailedHint")}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
            {error}
          </div>
        )}

        {(row.status === "scoping" || row.status === "awaiting_user") &&
          (row.scope_in.length > 0 || row.scope_out.length > 0) && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => finalize(false)}
                disabled={row.status === "awaiting_user"}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-1.5 text-xs text-[color:var(--text-primary)] transition-colors hover:border-[color:var(--accent-warm)] disabled:opacity-50"
              >
                {t("scopingFinalizeButton")}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
      </div>

      <ScopePreview
        scopeIn={row.scope_in}
        scopeOut={row.scope_out}
        lawCatalogMap={lawCatalogMap}
        locale={locale}
      />
    </div>
  );
}

// ============================================
// Progress header
// ============================================
function ScopingProgress({
  status,
  cursor,
  passageTotal,
  questionCount,
  maxQuestions,
}: {
  status: ScopingStatus;
  cursor: number;
  passageTotal: number;
  questionCount: number;
  maxQuestions: number;
}) {
  const t = useTranslations("audit");
  const statusLabel = (
    {
      created: t("scopingStatusCreated"),
      annotating: t("scopingStatusAnnotating"),
      scoping: t("scopingStatusScoping"),
      awaiting_user: t("scopingStatusAwaitingUser"),
      scope_locked: t("scopingStatusScopeLocked"),
      failed: t("scopingStatusFailed"),
    } as const
  )[status];

  const isThinking = status === "annotating" || status === "scoping" || status === "created";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-3">
      <div className="flex items-center gap-2">
        {isThinking ? (
          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--accent-warm)]" />
        ) : status === "awaiting_user" ? (
          <MessageCircleQuestion className="h-4 w-4 text-[color:var(--accent-warm)]" />
        ) : status === "scope_locked" ? (
          <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-warm)]" />
        ) : (
          <CircleAlert className="h-4 w-4 text-[#F87171]" />
        )}
        <span className="text-sm font-medium text-[color:var(--text-primary)]">{statusLabel}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[color:var(--text-tertiary)]">
        {passageTotal > 0 && (
          <span>
            {t("scopingProgressPassages", {
              cursor: Math.min(cursor, passageTotal),
              total: passageTotal,
            })}
          </span>
        )}
        <span>
          {t("scopingProgressQuestions", { used: questionCount, max: maxQuestions })}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Conversation feed
// ============================================
function ConversationFeed({
  conversation,
  pendingQuestion,
  status,
}: {
  conversation: ConversationTurn[];
  pendingQuestion: PendingQuestion | null;
  status: ScopingStatus;
}) {
  const t = useTranslations("audit");

  if (conversation.length === 0 && !pendingQuestion) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-tertiary)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("scopingThinking")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conversation.map((turn, i) => (
        <ConversationMessage key={i} turn={turn} />
      ))}
      {pendingQuestion && (
        <ConversationMessage
          turn={{
            role: "system",
            kind: "question",
            text: pendingQuestion.text,
            refs: { question_id: pendingQuestion.id },
          }}
          highlight
        />
      )}
      {(status === "scoping" || status === "annotating") && (
        <div className="flex items-center gap-2 text-sm text-[color:var(--text-tertiary)] pl-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("scopingThinking")}
        </div>
      )}
    </div>
  );
}

function ConversationMessage({
  turn,
  highlight = false,
}: {
  turn: ConversationTurn;
  highlight?: boolean;
}) {
  const t = useTranslations("audit");
  const isUser = turn.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-tertiary)] px-1">
          {isUser ? t("scopingMessageYou") : t("scopingMessageAgent")}
        </span>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-[color:var(--text-primary)] text-[color:var(--bg-primary)]"
              : highlight
              ? "border border-[color:var(--accent-warm)]/40 bg-[rgb(var(--accent-warm-rgb)/0.08)] text-[color:var(--text-primary)]"
              : turn.kind === "scope_update" || turn.kind === "note"
              ? "bg-[color:var(--bg-primary)] border border-[color:var(--border-default)] text-[color:var(--text-tertiary)] text-xs"
              : "bg-[color:var(--bg-primary)] border border-[color:var(--border-default)] text-[color:var(--text-primary)]"
          }`}
        >
          {turn.text}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Answer input
// ============================================
function ScopingAnswerInput({
  question,
  onSubmit,
}: {
  question: PendingQuestion;
  onSubmit: (answer: string) => Promise<void>;
}) {
  const t = useTranslations("audit");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  if (question.answer_format === "yes_no") {
    return (
      <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4">
        {question.context && (
          <p className="text-xs text-[color:var(--text-tertiary)] mb-3 leading-relaxed">
            {question.context}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(t("scopingAnswerYes"))}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-4 py-1.5 text-sm text-[color:var(--text-primary)] transition-colors hover:border-[color:var(--accent-warm)] disabled:opacity-50"
          >
            {t("scopingAnswerYes")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(t("scopingAnswerNo"))}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-4 py-1.5 text-sm text-[color:var(--text-primary)] transition-colors hover:border-[color:var(--accent-warm)] disabled:opacity-50"
          >
            {t("scopingAnswerNo")}
          </button>
        </div>
      </div>
    );
  }

  if (question.answer_format === "single_select" && question.options?.length) {
    return (
      <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4">
        {question.context && (
          <p className="text-xs text-[color:var(--text-tertiary)] mb-3 leading-relaxed">
            {question.context}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(opt)}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-4 py-1.5 text-sm text-[color:var(--text-primary)] transition-colors hover:border-[color:var(--accent-warm)] disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(text);
      }}
      className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4"
    >
      {question.context && (
        <p className="text-xs text-[color:var(--text-tertiary)] mb-3 leading-relaxed">
          {question.context}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("scopingAnswerPlaceholder")}
          rows={2}
          disabled={submitting}
          maxLength={4000}
          className="flex-1 rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm leading-relaxed text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent-warm)] focus:ring-2 focus:ring-[rgb(var(--accent-warm-rgb)/0.10)] resize-y"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="inline-flex items-center gap-1 rounded-md bg-[color:var(--text-primary)] px-3 py-2 text-sm text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{t("scopingSubmitAnswer")}</span>
        </button>
      </div>
    </form>
  );
}

// ============================================
// Scope preview sidebar
// ============================================
function ScopePreview({
  scopeIn,
  scopeOut,
  lawCatalogMap,
  locale,
}: {
  scopeIn: ScopedLaw[];
  scopeOut: ScopedLaw[];
  lawCatalogMap: Map<string, LawCatalogEntry>;
  locale: string;
}) {
  const t = useTranslations("audit");

  return (
    <aside className="space-y-4">
      <ScopeColumn
        title={t("scopingScopeInTitle")}
        items={scopeIn}
        accent="in"
        emptyLabel={t("scopingScopeEmpty")}
        lawCatalogMap={lawCatalogMap}
        locale={locale}
        passageRefsLabel={t}
      />
      <ScopeColumn
        title={t("scopingScopeOutTitle")}
        items={scopeOut}
        accent="out"
        emptyLabel={t("scopingScopeEmpty")}
        lawCatalogMap={lawCatalogMap}
        locale={locale}
        passageRefsLabel={t}
      />
    </aside>
  );
}

function ScopeColumn({
  title,
  items,
  accent,
  emptyLabel,
  lawCatalogMap,
  locale,
  passageRefsLabel,
}: {
  title: string;
  items: ScopedLaw[];
  accent: "in" | "out";
  emptyLabel: string;
  lawCatalogMap: Map<string, LawCatalogEntry>;
  locale: string;
  passageRefsLabel: ReturnType<typeof useTranslations>;
}) {
  const accentClass =
    accent === "in"
      ? "border-[color:var(--accent-warm)]/40"
      : "border-[color:var(--border-default)]";

  return (
    <div className={`rounded-xl border ${accentClass} bg-[color:var(--bg-secondary)] p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <ScanSearch
          className={`h-3.5 w-3.5 ${
            accent === "in"
              ? "text-[color:var(--accent-warm)]"
              : "text-[color:var(--text-tertiary)]"
          }`}
        />
        <span className="text-xs uppercase tracking-wider text-[color:var(--text-tertiary)]">
          {title}
        </span>
        <span className="text-xs text-[color:var(--text-tertiary)] ml-auto">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[color:var(--text-tertiary)] italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const law = lawCatalogMap.get(item.law_id);
            const name = law
              ? locale === "zh"
                ? law.name_zh
                : law.name_en
              : item.law_id;
            return (
              <li key={item.law_id} className="text-xs">
                <div className="font-medium text-[color:var(--text-primary)] mb-0.5">
                  {name}
                </div>
                {law && (
                  <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-tertiary)] mb-1">
                    {law.jurisdiction}
                  </div>
                )}
                {item.reason && (
                  <p className="text-[color:var(--text-tertiary)] leading-relaxed">
                    {item.reason}
                  </p>
                )}
                {item.passage_refs.length > 0 && (
                  <p className="text-[10px] text-[color:var(--text-tertiary)] mt-1">
                    {passageRefsLabel("scopingScopePassageRefs", {
                      refs: item.passage_refs.map((n) => n + 1).join(", "),
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
