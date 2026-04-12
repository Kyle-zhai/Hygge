"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, X } from "lucide-react";
import Link from "next/link";

export default function EditPersonaPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [occupation, setOccupation] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    fetch(`/api/personas/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data?.persona) return;
        const p = data.persona;
        setName(p.identity?.name ?? "");
        setTagline(p.identity?.tagline ?? "");
        setAvatar(p.identity?.avatar ?? "");
        setOccupation(p.demographics?.occupation ?? "");
        setDescription(p.description ?? "");
        setTagsInput((p.tags ?? []).join(", "));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/personas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tagline, occupation, description, tags }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      router.push(`/${locale}/personas`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#666462]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="mb-4 text-sm text-[#9B9594]">Persona not found or not editable</p>
        <Link
          href={`/${locale}/personas`}
          className="text-sm text-[#C4A882] transition-colors hover:text-[#D4B892]"
        >
          Back to My Personas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/${locale}/personas`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
      >
        <ArrowLeft className="h-4 w-4" />
        My Personas
      </Link>

      <div className="mb-8 flex items-center gap-4">
        {avatar && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-2xl">
            {avatar}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
            Edit Persona
          </h1>
          <p className="mt-0.5 text-sm text-[#666462]">
            Update your persona&apos;s public-facing information
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <Field label="Name" value={name} onChange={setName} placeholder="Persona name" />
        <Field label="Tagline" value={tagline} onChange={setTagline} placeholder="Their signature belief or motto" />
        <Field label="Occupation" value={occupation} onChange={setOccupation} placeholder="Job title" />
        <FieldArea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="A short public-facing description for marketplace listing"
          rows={3}
        />
        <Field
          label="Tags"
          value={tagsInput}
          onChange={setTagsInput}
          placeholder="Comma-separated, e.g. tech, startup, design"
        />
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href={`/${locale}/personas`}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2A2A2A] px-6 py-3 text-sm text-[#9B9594] transition-colors hover:border-[#444] hover:text-[#EAEAE8]"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={!name || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#C4A882] px-6 py-3 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#D4B892] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
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

function FieldArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; rows?: number;
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
