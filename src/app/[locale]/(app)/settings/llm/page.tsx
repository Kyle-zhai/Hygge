"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Key, Check, Loader2, AlertCircle, Trash2 } from "lucide-react";

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
    model: "qwen-max",
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
    hint: "OpenAI / Qwen / DeepSeek / OpenRouter / 自建代理",
  },
  { value: "anthropic", label: "Anthropic Claude", hint: "Messages API · x-api-key" },
  { value: "google", label: "Google Gemini", hint: "Generative Language API · key query param" },
];

interface LoadedSettings {
  provider_type: ProviderType;
  provider_label: string | null;
  base_url: string;
  model: string;
  vision_model: string | null;
  api_key_masked: string;
  updated_at: string;
}

export default function LLMSettingsPage() {
  const locale = useLocale();
  const zh = locale === "zh";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState<LoadedSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [providerType, setProviderType] = useState<ProviderType>("openai_compatible");
  const [providerLabel, setProviderLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setSaved(d.settings);
          setProviderType(d.settings.provider_type ?? "openai_compatible");
          setProviderLabel(d.settings.provider_label ?? "");
          setBaseUrl(d.settings.base_url ?? "");
          setModel(d.settings.model);
          setVisionModel(d.settings.vision_model ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function applyPreset(p: Preset) {
    setProviderType(p.providerType);
    setProviderLabel(p.label);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
    setVisionModel(p.vision ?? "");
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);
    if (!model || !apiKey) {
      setError(zh ? "请填写 Model 和 API Key" : "Model and API Key are required");
      return;
    }
    if (providerType === "openai_compatible" && !baseUrl) {
      setError(zh ? "OpenAI 兼容接口需要填写 Base URL" : "OpenAI-compatible providers require a Base URL");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_type: providerType,
        provider_label: providerLabel || null,
        base_url: baseUrl,
        model,
        vision_model: visionModel || null,
        api_key: apiKey,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || (zh ? "保存失败" : "Failed to save"));
      return;
    }
    setSuccess(true);
    setApiKey("");
    const reload = await fetch("/api/settings/llm");
    const d = await reload.json();
    setSaved(d.settings);
  }

  async function handleDelete() {
    if (!confirm(zh ? "确定要删除自定义 LLM 配置？将恢复为默认并回到免费额度。" : "Remove your custom LLM config and revert to the default plan?")) return;
    setDeleting(true);
    await fetch("/api/settings/llm", { method: "DELETE" });
    setDeleting(false);
    setSaved(null);
    setProviderType("openai_compatible");
    setProviderLabel("");
    setBaseUrl("");
    setModel("");
    setVisionModel("");
    setApiKey("");
    setSuccess(false);
  }

  const baseUrlRequired = providerType === "openai_compatible";
  const baseUrlPlaceholder =
    providerType === "anthropic"
      ? "https://api.anthropic.com (默认，可留空)"
      : providerType === "google"
      ? "https://generativelanguage.googleapis.com (默认，可留空)"
      : "https://api.example.com/v1";

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#666462]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {zh ? "LLM 供应商设置" : "LLM Provider Settings"}
        </h1>
        <p className="mt-1 text-sm text-[#9B9594]">
          {zh
            ? "使用你自己的 API 密钥（BYOK）— 支持任何模型：OpenAI 兼容、Anthropic Claude、Google Gemini。"
            : "Bring your own API key (BYOK) — supports OpenAI-compatible, Anthropic Claude, and Google Gemini."}
        </p>
        <p className="mt-2 rounded-lg border border-[#C4A882]/30 bg-[#C4A882]/5 px-3 py-2 text-xs text-[#C4A882]">
          {zh
            ? "✨ 配置自己的密钥后即刻解锁全部高级功能，且不占用每月额度。"
            : "✨ Saving a key unlocks every premium feature and removes the monthly quota."}
        </p>
      </div>

      {saved && (
        <div className="mb-6 rounded-xl border border-[#C4A882]/30 bg-[#C4A882]/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#C4A882] mb-1">
                {zh ? "当前生效" : "Active"} · {saved.provider_type}
              </p>
              <p className="text-sm text-[#EAEAE8] truncate">
                {saved.provider_label || saved.base_url || saved.provider_type}
              </p>
              <p className="text-xs text-[#9B9594] mt-1">
                {saved.model} · {zh ? "密钥" : "key"}: {saved.api_key_masked}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#F87171]/50 hover:text-[#F87171]"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {zh ? "移除" : "Remove"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462]">
          {zh ? "快速选择" : "Presets"}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[#9B9594]">
            {zh ? "供应商类型" : "Provider type"} <span className="text-[#F87171]">*</span>
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROVIDER_OPTIONS.map((opt) => {
              const active = providerType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProviderType(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-[#C4A882]/60 bg-[#C4A882]/10 text-[#EAEAE8]"
                      : "border-[#2A2A2A] bg-[#141414] text-[#9B9594] hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[11px] text-[#666462]">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </label>

        <Field
          label={zh ? "标签（可选）" : "Label (optional)"}
          value={providerLabel}
          onChange={setProviderLabel}
          placeholder="Qwen / Claude / Gemini ..."
        />
        <Field
          label="Base URL"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder={baseUrlPlaceholder}
          required={baseUrlRequired}
        />
        <Field
          label={zh ? "模型" : "Model"}
          value={model}
          onChange={setModel}
          placeholder={
            providerType === "anthropic"
              ? "claude-sonnet-4-6"
              : providerType === "google"
              ? "gemini-2.5-pro"
              : "qwen-max"
          }
          required
        />
        <Field
          label={zh ? "视觉模型（可选）" : "Vision model (optional)"}
          value={visionModel}
          onChange={setVisionModel}
          placeholder={
            providerType === "anthropic"
              ? "claude-sonnet-4-6"
              : providerType === "google"
              ? "gemini-2.5-pro"
              : "qwen3.5-omni-plus"
          }
        />
        <Field
          label={`API Key${saved ? ` ${zh ? "（留空保留当前）" : "(leave blank to keep current)"}` : ""}`}
          value={apiKey}
          onChange={setApiKey}
          placeholder={
            providerType === "anthropic"
              ? "sk-ant-..."
              : providerType === "google"
              ? "AIza..."
              : "sk-..."
          }
          type="password"
          required={!saved}
          icon={<Key className="h-3.5 w-3.5" />}
        />

        <p className="text-xs text-[#666462]">
          {zh
            ? "⚠ API Key 存储于数据库中，仅你的账号可读。仅为 MVP 方案，生产环境将迁移至 Vault 加密。"
            : "⚠ Your API key is stored in the database and readable only by your account. MVP-grade; Vault encryption planned."}
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#F87171]/30 bg-[#F87171]/5 p-3 text-xs text-[#F87171]">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-[#4ADE80]/30 bg-[#4ADE80]/5 p-3 text-xs text-[#4ADE80]">
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{zh ? "已保存！下次评估将使用你的配置。BYOK 已激活。" : "Saved — next evaluation will use your config. BYOK is now active."}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!apiKey && !saved)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E2DDD5] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#D4CFC7] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {zh ? "保存" : "Save"}
          </button>
        </div>
      </div>
    </div>
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
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666462]">{icon}</span>}
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
