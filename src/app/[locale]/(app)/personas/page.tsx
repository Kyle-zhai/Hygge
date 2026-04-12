"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Plus, Globe, Lock, Loader2, Trash2 } from "lucide-react";

interface PersonaItem {
  id: string;
  identity: { name: string; avatar: string; tagline: string };
  demographics: { occupation: string };
  description?: string;
  tags?: string[];
  is_custom?: boolean;
  is_public?: boolean;
  _source?: string;
}

export default function MyPersonasPage() {
  const locale = useLocale();
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((data) => {
        const custom = (data.personas ?? []).filter(
          (p: PersonaItem) => p._source === "custom" || p._source === "saved"
        );
        setPersonas(custom);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handlePublish(id: string) {
    await fetch(`/api/personas/${id}/publish`, { method: "POST" });
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_public: true } : p))
    );
  }

  async function handleUnpublish(id: string) {
    await fetch(`/api/personas/${id}/publish`, { method: "DELETE" });
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_public: false } : p))
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
            My Personas
          </h1>
          <p className="mt-1 text-sm text-[#666462]">
            Custom and saved personas for your discussions
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
      ) : personas.length === 0 ? (
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
          {personas.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#141414] px-5 py-4 transition-colors hover:border-[#333]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
                  {p.identity.avatar}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-[#EAEAE8]">
                      {p.identity.name}
                    </p>
                    {p._source === "saved" && (
                      <span className="rounded bg-[#1C1C1C] px-1.5 py-0.5 text-[10px] text-[#9B9594]">
                        Saved
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-[#666462]">
                    {p.demographics.occupation}
                    {p.description ? ` · ${p.description}` : ""}
                  </p>
                </div>
              </div>

              {p._source === "custom" && (
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {p.is_public ? (
                    <button
                      onClick={() => handleUnpublish(p.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
                    >
                      <Globe className="h-3 w-3" />
                      Public
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePublish(p.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#666462] transition-colors hover:text-[#EAEAE8]"
                    >
                      <Lock className="h-3 w-3" />
                      Private
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
