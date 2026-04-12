"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, ArrowLeft, Loader2 } from "lucide-react";
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

  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const body =
        tab === "form"
          ? { name, occupation, personality, background }
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create persona");
      }

      router.push(`/${locale}/personas`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const formValid = tab === "form" ? name && occupation && personality : importText.length > 20;

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
          <Field label="Name" placeholder="e.g. Elon Musk, Sarah the Designer" value={name} onChange={setName} />
          <Field label="Occupation" placeholder="e.g. CEO of Tesla & SpaceX, Senior UX Designer" value={occupation} onChange={setOccupation} />
          <FieldArea
            label="Personality & Values"
            placeholder="Describe their personality, values, how they think and communicate. e.g. 'First-principles thinker, risk-taking, blunt and direct, obsessed with efficiency and scale...'"
            value={personality}
            onChange={setPersonality}
            rows={4}
          />
          <FieldArea
            label="Background (optional)"
            placeholder="Any additional background: life story, expertise areas, known opinions, cultural context..."
            value={background}
            onChange={setBackground}
            rows={3}
          />
        </div>
      ) : (
        <div className="space-y-5">
          <Field
            label="Persona Name"
            placeholder="e.g. Elon Musk"
            value={importName}
            onChange={setImportName}
          />
          <FieldArea
            label="Character Definition"
            placeholder="Paste a character card JSON, system prompt, personality definition, or any text that describes the persona. Supports SillyTavern cards, OpenPersona JSON, or plain text descriptions."
            value={importText}
            onChange={setImportText}
            rows={10}
          />
          <p className="text-xs text-[#666462]">
            Supports: plain text descriptions, JSON character cards, system prompts, GitHub raw URLs content
          </p>
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
