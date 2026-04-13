"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Loader2, Eye, Heart, ArrowLeft } from "lucide-react";
import { PersonaAvatar } from "@/components/persona-avatar";

interface Publication {
  id: string;
  identity: { name: string; avatar: string; tagline: string; locale_variants?: Record<string, { name: string; tagline: string }> };
  demographics: { occupation: string };
  description: string | null;
  tags: string[];
  category: string;
  created_at: string;
  save_count: number;
  usage_count: number;
}

export default function MyPublicationsPage() {
  const locale = useLocale();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personas/publications")
      .then((r) => r.json())
      .then((data) => setPublications(data.publications || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#666462]" />
      </div>
    );
  }

  const totalSaves = publications.reduce((sum, p) => sum + p.save_count, 0);
  const totalUsages = publications.reduce((sum, p) => sum + p.usage_count, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/${locale}/personas`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
      >
        <ArrowLeft className="h-4 w-4" />
        My Personas
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
        My Publications
      </h1>
      <p className="mb-8 text-sm text-[#666462]">
        {locale === "zh" ? "查看你发布到 Marketplace 的 Persona 使用情况" : "Track how your published personas are being used"}
      </p>

      {publications.length === 0 ? (
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] px-6 py-16 text-center">
          <p className="text-sm text-[#9B9594]">
            {locale === "zh" ? "你还没有发布任何 Persona 到 Marketplace" : "You haven't published any personas to the marketplace yet"}
          </p>
          <Link
            href={`/${locale}/personas`}
            className="mt-4 inline-block text-sm text-[#C4A882] transition-colors hover:text-[#D4B892]"
          >
            {locale === "zh" ? "前往 My Personas" : "Go to My Personas"}
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3">
              <p className="text-xs text-[#666462]">{locale === "zh" ? "已发布" : "Published"}</p>
              <p className="mt-1 text-2xl font-semibold text-[#EAEAE8]">{publications.length}</p>
            </div>
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3">
              <p className="text-xs text-[#666462]">{locale === "zh" ? "被收藏" : "Total Saves"}</p>
              <p className="mt-1 text-2xl font-semibold text-[#C4A882]">{totalSaves}</p>
            </div>
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3">
              <p className="text-xs text-[#666462]">{locale === "zh" ? "被使用" : "Total Uses"}</p>
              <p className="mt-1 text-2xl font-semibold text-[#C4A882]">{totalUsages}</p>
            </div>
          </div>

          <div className="space-y-3">
            {publications.map((p) => {
              const localized = p.identity.locale_variants?.[locale] ?? { name: p.identity.name, tagline: p.identity.tagline };
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#141414] px-5 py-4 transition-colors hover:border-[#3A3A3A]"
                >
                  <PersonaAvatar avatar={p.identity.avatar} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-[#EAEAE8] truncate">{localized.name}</p>
                    <p className="mt-0.5 text-xs text-[#666462] truncate">
                      {p.demographics.occupation} · {localized.tagline}
                    </p>
                    {p.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {p.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-[#1C1C1C] px-2 py-0.5 text-[10px] text-[#9B9594]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-xs">
                    <div className="flex items-center gap-1.5 text-[#9B9594]">
                      <Heart className="h-3.5 w-3.5" />
                      <span>{p.save_count}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#9B9594]">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{p.usage_count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
