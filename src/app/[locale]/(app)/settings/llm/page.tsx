"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  Key,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

type ProviderType = "openai_compatible" | "anthropic" | "google";

interface Preset {
  label: string;
  providerType: ProviderType;
  baseUrl: string;
  model: string;
  vision?: string;
}

const PRESETS: Preset[] = [
  {
    label: "Qwen (Aliyun DashScope)",
    providerType: "openai_compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-plus",
    vision: "qwen3.5-omni-plus",
  },
  {
    label: "DeepSeek",
    providerType: "openai_compatible",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    label: "OpenAI",
    providerType: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    vision: "gpt-4o",
  },
  {
    label: "OpenRouter",
    providerType: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/auto",
  },
  {
    label: "Anthropic Claude",
    providerType: "anthropic",
    baseUrl: "",
    model: "claude-sonnet-4-6",
    vision: "claude-sonnet-4-6",
  },
  {
    label: "Google Gemini",
    providerType: "google",
    baseUrl: "",
    model: "gemini-2.5-pro",
    vision: "gemini-2.5-pro",
  },
];

const PROVIDER_OPTIONS: { value: ProviderType; label: string; hint: string }[] = [
  {
    value: "openai_compatible",
    label: "OpenAI-compatible",
    hint: "OpenAI / Qwen / GLM / DeepSeek / OpenRouter / 自建代理",
  },
  { value: "anthropic", label: "Anthropic Claude", hint: "Messages API · x-api-key" },
  { value: "google", label: "Google Gemini", hint: "Generative Language API · key query param" },
];

const MAX_ENTRIES = 10;

interface LoadedEntry {
  id: string;
  provider_type: ProviderType;
  label: string | null;
  base_url: string;
  model: string;
  vision_model: string | null;
  api_key_masked: string;
  order_index: number;
  updated_at: string;
}

interface EntryState {
  id: string | null;
  providerType: ProviderType;
  label: string;
  baseUrl: string;
  model: string;
  visionModel: string;
  apiKey: string;
  keyMasked: string;
  hadKey: boolean;
}

function blankEntry(): EntryState {
  return {
    id: null,
    providerType: "openai_compatible",
    label: "",
    baseUrl: "",
    model: "",
    visionModel: "",
    apiKey: "",
    keyMasked: "",
    hadKey: false,
  };
}

function entryFromLoaded(e: LoadedEntry): EntryState {
  return {
    id: e.id,
    providerType: e.provider_type,
    label: e.label ?? "",
    baseUrl: e.base_url ?? "",
    model: e.model,
    visionModel: e.vision_model ?? "",
    apiKey: "",
    keyMasked: e.api_key_masked,
    hadKey: true,
  };
}

export default function LLMSettingsPage() {
  const locale = useLocale();
  const zh = locale === "zh";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [entries, setEntries] = useState<EntryState[]>([]);
  const [hadSavedChain, setHadSavedChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((d) => {
        const loaded = Array.isArray(d.entries) ? (d.entries as LoadedEntry[]) : [];
        if (loaded.length > 0) {
          setEntries(loaded.map(entryFromLoaded));
          setHadSavedChain(true);
        } else {
          setEntries([blankEntry()]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function update(idx: number, patch: Partial<EntryState>) {
    setEntries((es) => es.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= entries.length) return;
    setEntries((es) => {
      const next = [...es];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function remove(idx: number) {
    setEntries((es) => {
      const next = es.filter((_, i) => i !== idx);
      return next.length === 0 ? [blankEntry()] : next;
    });
  }

  function add() {
    if (entries.length >= MAX_ENTRIES) return;
    setEntries((es) => [...es, blankEntry()]);
  }

  function applyPreset(idx: number, p: Preset) {
    update(idx, {
      providerType: p.providerType,
      label: p.label,
      baseUrl: p.baseUrl,
      model: p.model,
      visionModel: p.vision ?? "",
    });
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (entries.length === 0) {
      setError(zh ? "至少需要一条模型配置" : "At least one entry is required");
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const tag = `#${i + 1}`;
      if (!e.model.trim()) {
        setError(`${tag}: ${zh ? "请填写模型名" : "Model is required"}`);
        return;
      }
      if (e.providerType === "openai_compatible" && !e.baseUrl.trim()) {
        setError(`${tag}: ${zh ? "OpenAI 兼容接口需要 Base URL" : "Base URL is required"}`);
        return;
      }
      const willReuse = e.hadKey && Boolean(e.id) && !e.apiKey.trim();
      if (!willReuse && !e.apiKey.trim()) {
        setError(`${tag}: ${zh ? "请填写 API Key" : "API Key is required"}`);
        return;
      }
    }

    setSaving(true);
    const payload = {
      entries: entries.map((e) => {
        const reuse = e.hadKey && Boolean(e.id) && !e.apiKey.trim();
        const base = {
          provider_type: e.providerType,
          label: e.label.trim() || null,
          base_url: e.baseUrl.trim() || null,
          model: e.model.trim(),
          vision_model: e.visionModel.trim() || null,
        };
        if (reuse) return { ...base, id: e.id, keep_existing_key: true };
        return { ...base, api_key: e.apiKey.trim() };
      }),
    };

    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || (zh ? "保存失败" : "Save failed"));
      return;
    }

    setSuccess(true);
    const reload = await fetch("/api/settings/llm");
    const d = await reload.json();
    const loaded = Array.isArray(d.entries) ? (d.entries as LoadedEntry[]) : [];
    setEntries(loaded.length > 0 ? loaded.map(entryFromLoaded) : [blankEntry()]);
    setHadSavedChain(loaded.length > 0);
  }

  async function handleDeleteAll() {
    if (
      !confirm(
        zh
          ? "确定要清空所有 BYOK 配置并恢复默认？"
          : "Clear all BYOK entries and revert to the default plan?",
      )
    )
      return;
    setDeleting(true);
    await fetch("/api/settings/llm", { method: "DELETE" });
    setDeleting(false);
    setEntries([blankEntry()]);
    setHadSavedChain(false);
    setSuccess(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#666462]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {zh ? "LLM 供应商链路" : "LLM Provider Chain"}
        </h1>
        <p className="mt-1 text-sm text-[#9B9594]">
          {zh
            ? "按顺序排列多个模型（BYOK）。首项失败会自动切到下一项，直到全部失败才报错。"
            : "Order multiple providers (BYOK). On failure the worker falls through the chain until one succeeds."}
        </p>
        <p className="mt-2 rounded-lg border border-[#C4A882]/30 bg-[#C4A882]/5 px-3 py-2 text-xs text-[#C4A882]">
          {zh
            ? "✨ 配置任意一个密钥即解锁全部高级功能，且不占用每月额度。"
            : "✨ Any saved entry unlocks every premium feature and removes the monthly quota."}
        </p>
      </div>

      {hadSavedChain && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#C4A882]/30 bg-[#C4A882]/5 px-3 py-2">
          <span className="text-xs text-[#C4A882]">
            {zh ? `已激活链路 · ${entries.length} 个模型` : `Active chain · ${entries.length} entries`}
          </span>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={deleting}
            className="flex items-center gap-1.5 text-xs text-[#9B9594] transition-colors hover:text-[#F87171]"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {zh ? "清空全部" : "Clear all"}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {entries.map((entry, idx) => (
          <EntryCard
            key={idx}
            idx={idx}
            total={entries.length}
            entry={entry}
            zh={zh}
            onUpdate={(patch) => update(idx, patch)}
            onMove={(dir) => move(idx, dir)}
            onRemove={() => remove(idx)}
            onPreset={(p) => applyPreset(idx, p)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={entries.length >= MAX_ENTRIES}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#2A2A2A] bg-[#0C0C0C] py-3 text-sm text-[#9B9594] transition-colors hover:border-[#C4A882]/50 hover:text-[#C4A882] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        {zh ? "添加备选模型" : "Add fallback entry"}
        <span className="text-xs text-[#666462]">
          ({entries.length}/{MAX_ENTRIES})
        </span>
      </button>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F87171]/30 bg-[#F87171]/5 p-3 text-xs text-[#F87171]">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#4ADE80]/30 bg-[#4ADE80]/5 p-3 text-xs text-[#4ADE80]">
          <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            {zh
              ? "已保存！下次评估按此链路执行。BYOK 已激活。"
              : "Saved — next evaluation runs through this chain. BYOK is active."}
          </span>
        </div>
      )}

      <p className="mt-4 text-xs text-[#666462]">
        {zh
          ? "⚠ API Key 会加密存储于数据库，仅你的账号可读。"
          : "⚠ API keys are encrypted at rest and readable only by your account."}
      </p>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E2DDD5] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#D4CFC7] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {zh ? "保存链路" : "Save chain"}
        </button>
      </div>
    </div>
  );
}

function EntryCard({
  idx,
  total,
  entry,
  zh,
  onUpdate,
  onMove,
  onRemove,
  onPreset,
}: {
  idx: number;
  total: number;
  entry: EntryState;
  zh: boolean;
  onUpdate: (patch: Partial<EntryState>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPreset: (p: Preset) => void;
}) {
  const baseUrlRequired = entry.providerType === "openai_compatible";
  const baseUrlPlaceholder =
    entry.providerType === "anthropic"
      ? "https://api.anthropic.com (默认，可留空)"
      : entry.providerType === "google"
      ? "https://generativelanguage.googleapis.com (默认，可留空)"
      : "https://api.example.com/v1";

  const roleLabel = zh
    ? idx === 0
      ? "主模型"
      : `备选 ${idx}`
    : idx === 0
    ? "Primary"
    : `Fallback ${idx}`;

  const keyPlaceholder = entry.hadKey && entry.keyMasked
    ? `${entry.keyMasked} (${zh ? "留空保留当前" : "leave blank to keep"})`
    : entry.providerType === "anthropic"
    ? "sk-ant-..."
    : entry.providerType === "google"
    ? "AIza..."
    : "sk-...";

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#C4A882]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#C4A882]">
            #{idx + 1} · {roleLabel}
          </span>
          {entry.hadKey && (
            <span className="text-[11px] text-[#666462]">
              {zh ? "已保存" : "saved"}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <IconButton onClick={() => onMove(-1)} disabled={idx === 0} title={zh ? "上移" : "Move up"}>
            <ArrowUp className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => onMove(1)}
            disabled={idx === total - 1}
            title={zh ? "下移" : "Move down"}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={onRemove} title={zh ? "删除" : "Remove"} danger>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#666462]">
          {zh ? "快速选择" : "Presets"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onPreset(p)}
              className="rounded-md border border-[#2A2A2A] bg-[#0C0C0C] px-2.5 py-1 text-[11px] text-[#9B9594] transition-colors hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-[#9B9594]">
          {zh ? "供应商类型" : "Provider type"} <span className="text-[#F87171]">*</span>
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PROVIDER_OPTIONS.map((opt) => {
            const active = entry.providerType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ providerType: opt.value })}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[#C4A882]/60 bg-[#C4A882]/10 text-[#EAEAE8]"
                    : "border-[#2A2A2A] bg-[#0C0C0C] text-[#9B9594] hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[11px] text-[#666462]">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={zh ? "标签（可选）" : "Label (optional)"}
          value={entry.label}
          onChange={(v) => onUpdate({ label: v })}
          placeholder="Qwen / Claude / Gemini ..."
        />
        <Field
          label="Base URL"
          value={entry.baseUrl}
          onChange={(v) => onUpdate({ baseUrl: v })}
          placeholder={baseUrlPlaceholder}
          required={baseUrlRequired}
        />
        <Field
          label={zh ? "模型" : "Model"}
          value={entry.model}
          onChange={(v) => onUpdate({ model: v })}
          placeholder={
            entry.providerType === "anthropic"
              ? "claude-sonnet-4-6"
              : entry.providerType === "google"
              ? "gemini-2.5-pro"
              : "qwen3.6-plus"
          }
          required
        />
        <Field
          label={zh ? "视觉模型（可选）" : "Vision model (optional)"}
          value={entry.visionModel}
          onChange={(v) => onUpdate({ visionModel: v })}
          placeholder={
            entry.providerType === "anthropic"
              ? "claude-sonnet-4-6"
              : entry.providerType === "google"
              ? "gemini-2.5-pro"
              : "qwen3.5-omni-plus"
          }
        />
      </div>

      <Field
        label={`API Key${entry.hadKey ? ` (${zh ? "留空保留" : "leave blank to keep"})` : ""}`}
        value={entry.apiKey}
        onChange={(v) => onUpdate({ apiKey: v })}
        placeholder={keyPlaceholder}
        type="password"
        required={!entry.hadKey}
        icon={<Key className="h-3.5 w-3.5" />}
      />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] bg-[#0C0C0C] text-[#9B9594] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? "hover:border-[#F87171]/50 hover:text-[#F87171]" : "hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#9B9594]">
        {label} {required && <span className="text-[#F87171]">*</span>}
      </span>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666462]">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] py-2.5 text-sm text-[#EAEAE8] placeholder:text-[#666462] outline-none transition-colors focus:border-[#C4A882]/50 ${
            icon ? "pl-9 pr-3" : "px-3"
          }`}
        />
      </div>
    </label>
  );
}
