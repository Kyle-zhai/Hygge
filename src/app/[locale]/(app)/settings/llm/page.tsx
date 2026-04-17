"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Key, Check, Loader2, AlertCircle, Trash2 } from "lucide-react";

interface Preset {
  label: string;
  baseUrl: string;
  model: string;
  vision?: string;
}

const PRESETS: Preset[] = [
  {
    label: "Qwen (Aliyun DashScope)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
    vision: "qwen3.5-omni-plus",
  },
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    vision: "gpt-4o",
  },
  {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/auto",
  },
];

interface LoadedSettings {
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
          setProviderLabel(d.settings.provider_label ?? "");
          setBaseUrl(d.settings.base_url);
          setModel(d.settings.model);
          setVisionModel(d.settings.vision_model ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function applyPreset(p: Preset) {
    setProviderLabel(p.label);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
    setVisionModel(p.vision ?? "");
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);
    if (!baseUrl || !model || !apiKey) {
      setError(zh ? "请填写 Base URL、Model 和 API Key" : "Base URL, Model, and API Key are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    if (!confirm(zh ? "确定要删除自定义 LLM 配置？将恢复为默认 Qwen。" : "Remove your custom LLM config and revert to the default Qwen?")) return;
    setDeleting(true);
    await fetch("/api/settings/llm", { method: "DELETE" });
    setDeleting(false);
    setSaved(null);
    setProviderLabel("");
    setBaseUrl("");
    setModel("");
    setVisionModel("");
    setApiKey("");
    setSuccess(false);
  }

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
            ? "使用你自己的 API 密钥（BYOK）— 支持任何 OpenAI 兼容接口。"
            : "Bring your own API key (BYOK) — works with any OpenAI-compatible endpoint."}
        </p>
      </div>

      {saved && (
        <div className="mb-6 rounded-xl border border-[#C4A882]/30 bg-[#C4A882]/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#C4A882] mb-1">
                {zh ? "当前生效" : "Active"}
              </p>
              <p className="text-sm text-[#EAEAE8] truncate">
                {saved.provider_label || saved.base_url}
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
        <Field
          label={zh ? "标签（可选）" : "Label (optional)"}
          value={providerLabel}
          onChange={setProviderLabel}
          placeholder="Qwen / OpenAI / DeepSeek ..."
        />
        <Field
          label="Base URL"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="https://api.example.com/v1"
          required
        />
        <Field
          label={zh ? "模型" : "Model"}
          value={model}
          onChange={setModel}
          placeholder="qwen-max"
          required
        />
        <Field
          label={zh ? "视觉模型（可选）" : "Vision model (optional)"}
          value={visionModel}
          onChange={setVisionModel}
          placeholder="qwen3.5-omni-plus"
        />
        <Field
          label={`API Key${saved ? ` ${zh ? "（留空保留当前）" : "(leave blank to keep current)"}` : ""}`}
          value={apiKey}
          onChange={setApiKey}
          placeholder="sk-..."
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
            <span>{zh ? "已保存！下次评估将使用你的配置。" : "Saved — next evaluation will use your config."}</span>
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
