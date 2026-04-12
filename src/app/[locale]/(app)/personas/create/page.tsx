"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, ArrowLeft, Loader2, FileText, X, ChevronDown } from "lucide-react";
import Link from "next/link";

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
          ? { name, occupation, personality, background: fullBackground }
          : {
              name: importName || "Imported Persona",
              occupation: "Imported",
              personality: "See imported definition",
              importedText: importText,
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const formValid = tab === "form" ? name && occupation && personality : importName && importText.length > 20;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/${locale}/personas`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
      >
        <ArrowLeft className="h-4 w-4" />
        My Personas
      </Link>

      <h1 className="mb-2 text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
        Create Persona
      </h1>
      <p className="mb-8 text-sm text-[#666462]">
        Build a custom AI persona for your round table discussions
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
          Create from scratch
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
          Import external
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      {tab === "form" ? (
        <div className="space-y-5">
          <Field label="Name" placeholder="e.g. Alex Chen, Maria Rodriguez" value={name} onChange={setName} />
          <Field label="Occupation" placeholder="e.g. Startup Founder, Senior UX Designer, College Student" value={occupation} onChange={setOccupation} />
          <FieldArea
            label="Personality & Values"
            placeholder="Describe their personality, values, how they think and communicate. e.g. 'Analytical and data-driven, skeptical of hype, values simplicity over complexity, always asks about ROI...'"
            value={personality}
            onChange={setPersonality}
            rows={4}
          />
          <FieldArea
            label="Background (optional)"
            placeholder="Any additional context: life experiences, expertise areas, cultural background, opinions..."
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
            Advanced details
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C]/50 p-4">
              <p className="text-xs text-[#C4A882]">
                The more details you provide, the richer and more realistic the persona will be. All fields are optional.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Age" placeholder="e.g. 35" value={age} onChange={setAge} />
                <Field label="Location" placeholder="e.g. San Francisco, USA" value={location} onChange={setLocation} />
              </div>
              <Field label="Education" placeholder="e.g. MBA from a state university" value={education} onChange={setEducation} />
              <FieldArea
                label="Speaking Style"
                placeholder="e.g. Uses lots of metaphors, speaks in short decisive sentences, often references data..."
                value={speakingStyle}
                onChange={setSpeakingStyle}
                rows={2}
              />
              <FieldArea
                label="Known Biases & Blind Spots"
                placeholder="e.g. Tends to favor technical solutions over process changes, underestimates marketing..."
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
            label="Persona Name"
            placeholder="e.g. The Skeptical Engineer, Budget-Conscious Mom"
            value={importName}
            onChange={setImportName}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#EAEAE8]">
              Character Document
            </label>
            {fileName ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-[#C4A882]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#EAEAE8]">{fileName}</p>
                  <p className="text-xs text-[#666462]">
                    {importText.length.toLocaleString()} characters
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
                    Drop a <span className="text-[#C4A882]">.md</span> or <span className="text-[#C4A882]">.txt</span> file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-[#666462]">
                    Any character description, skill definition, or persona document
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
            Generating persona...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Persona
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
