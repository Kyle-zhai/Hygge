"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Bookmark, BookmarkCheck, Users, Loader2 } from "lucide-react";

interface MarketplacePersona {
  id: string;
  identity: { name: string; avatar: string; tagline: string };
  demographics: { occupation: string };
  description?: string;
  tags?: string[];
  uses_count: number;
  source: string;
  is_saved: boolean;
}

const TAG_FILTERS = [
  "All",
  "business",
  "technical",
  "creative",
  "academic",
  "public-figure",
  "end-user",
];

export default function MarketplacePage() {
  const [personas, setPersonas] = useState<MarketplacePersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tag) params.set("tag", tag);
    params.set("page", String(page));

    const res = await fetch(`/api/marketplace?${params}`);
    const data = await res.json();
    setPersonas(data.personas ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [search, tag, page]);

  useEffect(() => {
    const timer = setTimeout(fetchPersonas, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPersonas]);

  async function toggleSave(id: string, saved: boolean) {
    setSavingId(id);
    await fetch(`/api/personas/${id}/save`, { method: saved ? "DELETE" : "POST" });
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_saved: !saved } : p))
    );
    setSavingId(null);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          Persona Marketplace
        </h1>
        <p className="mt-1 text-sm text-[#666462]">
          Discover community-created personas for your discussions
        </p>
      </div>

      {/* Search */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-3">
        <Search className="h-4 w-4 text-[#666462]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search personas..."
          className="flex-1 bg-transparent text-sm text-[#EAEAE8] placeholder:text-[#666462] outline-none"
        />
      </div>

      {/* Tags */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TAG_FILTERS.map((t) => {
          const active = t === "All" ? !tag : tag === t;
          return (
            <button
              key={t}
              onClick={() => { setTag(t === "All" ? "" : t); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-[#C4A882]/20 text-[#C4A882] border border-[#C4A882]/30"
                  : "bg-[#1C1C1C] text-[#9B9594] border border-transparent hover:text-[#EAEAE8]"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#666462]" />
        </div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="mb-3 h-8 w-8 text-[#666462]" />
          <p className="text-sm text-[#9B9594]">No personas found</p>
          <p className="mt-1 text-xs text-[#666462]">
            {search ? "Try a different search" : "Be the first to publish a persona!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {personas.map((p) => (
              <div
                key={p.id}
                className="group rounded-xl border border-[#2A2A2A] bg-[#141414] p-5 transition-colors hover:border-[#333]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
                      {p.identity.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#EAEAE8]">
                        {p.identity.name}
                      </p>
                      <p className="text-xs text-[#666462]">{p.demographics.occupation}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSave(p.id, p.is_saved)}
                    disabled={savingId === p.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#C4A882]"
                  >
                    {p.is_saved ? (
                      <BookmarkCheck className="h-4 w-4 text-[#C4A882]" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="mb-3 text-xs text-[#9B9594] line-clamp-2">
                  {p.description || p.identity.tagline}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {(p.tags ?? []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-[#1C1C1C] px-2 py-0.5 text-[10px] text-[#9B9594]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#666462]">
                    {p.uses_count} uses
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-xs text-[#9B9594] transition-colors hover:text-[#EAEAE8] disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-[#666462]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-xs text-[#9B9594] transition-colors hover:text-[#EAEAE8] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
