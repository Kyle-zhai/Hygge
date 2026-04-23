"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, ArrowLeft, Loader2, FileText, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { AvatarUpload } from "@/components/avatar-upload";

type Tab = "form" | "import";

export default function CreatePersonaPage() {
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [personality, setPersonality] = useState("");
  const [background, setBackground] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [education, setEducation] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");
  const [knownBiases, setKnownBiases] = useState("");

  const [avatarUrl, setAvatarUrl] = useState("");

  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");
  const [fileName, setFileName] = useState("");

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const advancedParts: string[] = [];
      if (age) advancedParts.push(`Age: ${age}`);
      if (location) advancedParts.push(`Location: ${location}`);
      if (education) advancedParts.push(`Education: ${education}`);
      if (speakingStyle) advancedParts.push(`Speaking style: ${speakingStyle}`);
      if (knownBiases) advancedParts.push(`Known biases: ${knownBiases}`);
      const fullBackground = [background, ...advancedParts].filter(Boolean).join("\n");

      const body =
        tab === "form"
          ? { name, occupation, personality, background: fullBackground, avatarUrl: avatarUrl || undefined }
          : {
              name: importName || "Imported Persona",
              occupation: "Imported",
              personality: "See imported definition",
              importedText: importText,
              avatarUrl: avatarUrl || undefined,
            };

      const res = await fetch("/api/personas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to create persona");
      }

      const jobId = resData.jobId;
      const pending = JSON.parse(localStorage.getItem("pendingPersonas") || "[]");
      pending.push({ jobId, name: tab === "form" ? name : (importName || "Imported Persona"), createdAt: Date.now() });
      localStorage.setItem("pendingPersonas", JSON.stringify(pending));
      router.push(`/${locale}/personas`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const formValid = tab === "form" ? name && occupation && personality : importName && importText.length > 20;
  const zh = locale === "zh";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/${locale}/personas`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
      >
        <ArrowLeft className="h-4 w-4" />
        {zh ? "我的人格" : "My Personas"}
      </Link>

      <h1 className="mb-2 text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
        {zh ? "创建人格" : "Create Persona"}
      </h1>
      <p className="mb-8 text-sm text-[#666462]">
        {zh ? "为你的圆桌讨论构建一个定制的 AI 人格" : "Build a custom AI persona for your round table discussions"}
      </p>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#0C0C0C] border border-[#2A2A2A] p-1">
        <button
          onClick={() => setTab("form")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "form"
              ? "bg-[#1C1C1C] text-[#EAEAE8]"
              : "text-[#666462] hover:text-[#9B9594]"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          {zh ? "从零创建" : "Create from scratch"}
        </button>
        <button
          onClick={() => setTab("import")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "import"
              ? "bg-[#1C1C1C] text-[#EAEAE8]"
              : "text-[#666462] hover:text-[#9B9594]"
          }`}
        >
          <Upload className="h-4 w-4" />
          {zh ? "导入外部" : "Import external"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      <div className="mb-6">
        <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} />
      </div>

      {tab === "form" ? (
        <div className="space-y-5">
          <Field
            label={zh ? "姓名" : "Name"}
            placeholder={zh ? "例如：陈艾力、玛利亚·罗德里格斯" : "e.g. Alex Chen, Maria Rodriguez"}
            value={name}
            onChange={setName}
          />
          <Field
            label={zh ? "职业" : "Occupation"}
            placeholder={zh ? "例如：创业者、资深 UX 设计师、大学生" : "e.g. Startup Founder, Senior UX Designer, College Student"}
            value={occupation}
            onChange={setOccupation}
          />
          <FieldArea
            label={zh ? "性格与价值观" : "Personality & Values"}
            placeholder={zh
              ? "描述他们的性格、价值观、思考和沟通方式。例如：'分析型、数据驱动，对炒作持怀疑态度，偏好简单而非复杂，总是关注 ROI…'"
              : "Describe their personality, values, how they think and communicate. e.g. 'Analytical and data-driven, skeptical of hype, values simplicity over complexity, always asks about ROI...'"}
            value={personality}
            onChange={setPersonality}
            rows={4}
          />
          <FieldArea
            label={zh ? "背景（选填）" : "Background (optional)"}
            placeholder={zh
              ? "任何额外的背景信息：人生经历、专业领域、文化背景、观点…"
              : "Any additional context: life experiences, expertise areas, cultural background, opinions..."}
            value={background}
            onChange={setBackground}
            rows={3}
          />

          {/* Advanced details toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            {zh ? "高级设置" : "Advanced details"}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C]/50 p-4">
              <p className="text-xs text-[#C4A882]">
                {zh
                  ? "提供的细节越多，生成的人格越丰富、越真实。所有字段都为选填。"
                  : "The more details you provide, the richer and more realistic the persona will be. All fields are optional."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={zh ? "年龄" : "Age"}
                  placeholder={zh ? "例如：35" : "e.g. 35"}
                  value={age}
                  onChange={setAge}
                />
                <Field
                  label={zh ? "所在地" : "Location"}
                  placeholder={zh ? "例如：上海" : "e.g. San Francisco, USA"}
                  value={location}
                  onChange={setLocation}
                />
              </div>
              <Field
                label={zh ? "教育背景" : "Education"}
                placeholder={zh ? "例如：普通大学 MBA" : "e.g. MBA from a state university"}
                value={education}
                onChange={setEducation}
              />
              <FieldArea
                label={zh ? "说话风格" : "Speaking Style"}
                placeholder={zh
                  ? "例如：常用比喻、说话简短果断、经常引用数据…"
                  : "e.g. Uses lots of metaphors, speaks in short decisive sentences, often references data..."}
                value={speakingStyle}
                onChange={setSpeakingStyle}
                rows={2}
              />
              <FieldArea
                label={zh ? "已知偏见与盲点" : "Known Biases & Blind Spots"}
                placeholder={zh
                  ? "例如：倾向于用技术方案解决流程问题、低估营销的重要性…"
                  : "e.g. Tends to favor technical solutions over process changes, underestimates marketing..."}
                value={knownBiases}
                onChange={setKnownBiases}
                rows={2}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Field
            label={zh ? "人格名称" : "Persona Name"}
            placeholder={zh
              ? "例如：怀疑派工程师、精打细算的妈妈"
              : "e.g. The Skeptical Engineer, Budget-Conscious Mom"}
            value={importName}
            onChange={setImportName}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#EAEAE8]">
              {zh ? "角色文档" : "Character Document"}
            </label>
            {fileName ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-[#C4A882]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#EAEAE8]">{fileName}</p>
                  <p className="text-xs text-[#666462]">
                    {zh
                      ? `${importText.length.toLocaleString()} 个字符`
                      : `${importText.length.toLocaleString()} characters`}
                  </p>
                </div>
                <button
                  onClick={() => { setFileName(""); setImportText(""); }}
                  className="rounded-lg p-1.5 text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-[#2A2A2A] bg-[#0C0C0C] px-4 py-8 transition-colors hover:border-[#C4A882]/40">
                <Upload className="h-6 w-6 text-[#666462]" />
                <div className="text-center">
                  <p className="text-sm text-[#9B9594]">
                    {zh ? (
                      <>
                        拖拽 <span className="text-[#C4A882]">.md</span> 或 <span className="text-[#C4A882]">.txt</span> 文件到此处，或点击浏览
                      </>
                    ) : (
                      <>
                        Drop a <span className="text-[#C4A882]">.md</span> or <span className="text-[#C4A882]">.txt</span> file here, or click to browse
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#666462]">
                    {zh
                      ? "任何角色描述、技能定义或人格文档"
                      : "Any character description, skill definition, or persona document"}
                  </p>
                </div>
                <input
                  type="file"
                  accept=".md,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!formValid || submitting}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C4A882] px-6 py-3 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#D4B892] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {zh ? "正在生成..." : "Generating persona..."}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {zh ? "生成人格" : "Generate Persona"}
          </>
        )}
      </button>
    </div>
  );
}

function Field({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#EAEAE8]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-2.5 text-sm text-[#EAEAE8] placeholder:text-[#444] outline-none transition-colors focus:border-[#C4A882]/50"
      />
    </div>
  );
}

function FieldArea({ label, placeholder, value, onChange, rows = 4 }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#EAEAE8]">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-2.5 text-sm text-[#EAEAE8] placeholder:text-[#444] outline-none transition-colors focus:border-[#C4A882]/50 resize-none"
      />
    </div>
  );
}
