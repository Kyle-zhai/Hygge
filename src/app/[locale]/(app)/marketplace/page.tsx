"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Search, Bookmark, BookmarkCheck, Users, Loader2 } from "lucide-react";
import {
  KIND_LABEL,
  topicSubOptionsByDomain,
  productOptions,
  type MarketplaceKind,
} from "@/lib/personas/marketplace-taxonomy";

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

export default function MarketplacePage() {
  const locale = useLocale();
  const zh = locale === "zh";
  const [personas, setPersonas] = useState<MarketplacePersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<MarketplaceKind | "">("");
  const [subDomain, setSubDomain] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kind) params.set("kind", kind);
    if (kind === "topic" && subDomain) params.set("sub_domain", subDomain);
    if (kind === "product" && productCategory) params.set("product_category", productCategory);
    params.set("page", String(page));

    const res = await fetch(`/api/marketplace?${params}`);
    const data = await res.json();
    setPersonas(data.personas ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [search, kind, subDomain, productCategory, page]);

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
          {zh ? "人格市场" : "Persona Marketplace"}
        </h1>
        <p className="mt-1 text-sm text-[#666462]">
          {zh
            ? "探索社区创建的人格，用于你的讨论"
            : "Discover community-created personas for your discussions"}
        </p>
      </div>

      {/* Search */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-3">
        <Search className="h-4 w-4 text-[#666462]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={zh ? "搜索人格..." : "Search personas..."}
          className="flex-1 bg-transparent text-sm text-[#EAEAE8] placeholder:text-[#666462] outline-none"
        />
      </div>

      {/* Kind filter */}
      <div className="mb-3 flex flex-wrap gap-2">
        {([
          { value: "" as const, label: zh ? "全部" : "All" },
          { value: "topic" as MarketplaceKind, label: zh ? KIND_LABEL.topic.zh : KIND_LABEL.topic.en },
          { value: "product" as MarketplaceKind, label: zh ? KIND_LABEL.product.zh : KIND_LABEL.product.en },
          { value: "general" as MarketplaceKind, label: zh ? KIND_LABEL.general.zh : KIND_LABEL.general.en },
        ]).map((k) => {
          const active = kind === k.value;
          return (
            <button
              key={k.value || "all"}
              onClick={() => {
                setKind(k.value || "");
                setSubDomain("");
                setProductCategory("");
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-[#C4A882]/20 text-[#C4A882] border border-[#C4A882]/30"
                  : "bg-[#1C1C1C] text-[#9B9594] border border-transparent hover:text-[#EAEAE8]"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Sub-filter */}
      {kind === "topic" && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          <button
            onClick={() => { setSubDomain(""); setPage(1); }}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              subDomain === ""
                ? "bg-[#C4A882]/20 text-[#C4A882] border border-[#C4A882]/30"
                : "bg-[#0C0C0C] text-[#9B9594] border border-[#2A2A2A] hover:text-[#EAEAE8]"
            }`}
          >
            {zh ? "全部" : "All"}
          </button>
          {topicSubOptionsByDomain().map((g) => (
            g.subs.map((s) => (
              <button
                key={s.value}
                onClick={() => { setSubDomain(s.value); setPage(1); }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  subDomain === s.value
                    ? "bg-[#C4A882]/20 text-[#C4A882] border border-[#C4A882]/30"
                    : "bg-[#0C0C0C] text-[#9B9594] border border-[#2A2A2A] hover:text-[#EAEAE8]"
                }`}
                title={zh ? g.label_zh : g.label_en}
              >
                {zh ? s.label_zh : s.label_en}
              </button>
            ))
          ))}
        </div>
      )}
      {kind === "product" && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          <button
            onClick={() => { setProductCategory(""); setPage(1); }}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              productCategory === ""
                ? "bg-[#C4A882]/20 text-[#C4A882] border border-[#C4A882]/30"
                : "bg-[#0C0C0C] text-[#9B9594] border border-[#2A2A2A] hover:text-[#EAEAE8]"
            }`}
          >
            {zh ? "全部" : "All"}
          </button>
          {productOptions().map((o) => (
            <button
              key={o.value}
              onClick={() => { setProductCategory(o.value); setPage(1); }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                productCategory === o.value
                  ? "bg-[#C4A882]/20 text-[#C4A882] border border-[#C4A882]/30"
                  : "bg-[#0C0C0C] text-[#9B9594] border border-[#2A2A2A] hover:text-[#EAEAE8]"
              }`}
            >
              {zh ? o.label_zh : o.label_en}
            </button>
          ))}
        </div>
      )}
      {kind !== "topic" && kind !== "product" && <div className="mb-6" />}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#666462]" />
        </div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="mb-3 h-8 w-8 text-[#666462]" />
          <p className="text-sm text-[#9B9594]">
            {zh ? "未找到人格" : "No personas found"}
          </p>
          <p className="mt-1 text-xs text-[#666462]">
            {search
              ? zh
                ? "换个关键词试试"
                : "Try a different search"
              : zh
              ? "成为第一个发布人格的用户！"
              : "Be the first to publish a persona!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {personas.map((p) => (
              <Link
                key={p.id}
                href={`/${locale}/marketplace/${p.id}`}
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSave(p.id, p.is_saved);
                    }}
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
                    {zh ? `${p.uses_count} 次使用` : `${p.uses_count} uses`}
                  </span>
                </div>
              </Link>
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
                {zh ? "上一页" : "Previous"}
              </button>
              <span className="text-xs text-[#666462]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-xs text-[#9B9594] transition-colors hover:text-[#EAEAE8] disabled:opacity-30"
              >
                {zh ? "下一页" : "Next"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
