"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ChevronDown, ChevronUp, Filter, Loader2, Bookmark, X, Heart, User } from "lucide-react";

interface PersonaSquad {
  id: string;
  name: string;
  persona_ids: string[];
  created_at: string;
}

interface PersonaData {
  id: string;
  identity: {
    name: string;
    avatar: string;
    tagline: string;
    tags?: string[];
    locale_variants: {
      zh: { name: string; tagline: string };
      en: { name: string; tagline: string };
    };
  };
  demographics: { age: number; gender: string; occupation: string; income_level: string };
  evaluation_lens: { primary_question: string };
  category: string;
  is_custom?: boolean;
  creator_id?: string;
}

interface PersonaSelectorProps {
  projectDescription: string;
  maxPersonas: number;
  onConfirm: (selectedIds: string[]) => void;
  disabled?: boolean;
  mode?: "topic" | "product";
}

const productCategoryOrder = ["technical", "product", "design", "end_user", "business"];
const generalCategoryOrder = ["general"];

const categoryLabels: Record<string, Record<string, string>> = {
  technical: { zh: "\u6280\u672F", en: "Technical" },
  product: { zh: "\u4EA7\u54C1", en: "Product" },
  design: { zh: "\u8BBE\u8BA1", en: "Design" },
  end_user: { zh: "\u7528\u6237", en: "End User" },
  business: { zh: "\u5546\u4E1A", en: "Business" },
  general: { zh: "\u901A\u7528", en: "General" },
};

const ageRanges = [
  { label: "18-24", min: 18, max: 24 },
  { label: "25-34", min: 25, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45-54", min: 45, max: 54 },
  { label: "55+", min: 55, max: 120 },
];

const genderLabels: Record<string, Record<string, string>> = {
  M: { zh: "\u7537", en: "Male" },
  F: { zh: "\u5973", en: "Female" },
  NB: { zh: "\u975E\u4E8C\u5143", en: "Non-binary" },
};

const incomeLabels: Record<string, Record<string, string>> = {
  low: { zh: "\u4F4E", en: "Low" },
  medium: { zh: "\u4E2D\u7B49", en: "Medium" },
  medium_high: { zh: "\u4E2D\u9AD8", en: "Mid-High" },
  high: { zh: "\u9AD8", en: "High" },
  very_high: { zh: "\u6781\u9AD8", en: "Very High" },
};

export function PersonaSelector({ projectDescription, maxPersonas, onConfirm, disabled, mode = "product" }: PersonaSelectorProps) {
  const categoryOrder = mode === "topic" ? generalCategoryOrder : productCategoryOrder;
  const t = useTranslations("evaluation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filters — special values: "my_saved", "my_custom"
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [ageFilters, setAgeFilters] = useState<Set<string>>(new Set());
  const [genderFilters, setGenderFilters] = useState<Set<string>>(new Set());
  const [incomeFilters, setIncomeFilters] = useState<Set<string>>(new Set());

  // Squads
  const [squads, setSquads] = useState<PersonaSquad[]>([]);
  const [activeSquadId, setActiveSquadId] = useState<string | null>(null);
  const [showSaveSquad, setShowSaveSquad] = useState(false);
  const [squadNameDraft, setSquadNameDraft] = useState("");
  const [savingSquad, setSavingSquad] = useState(false);

  useEffect(() => {
    async function load() {
      const [personasRes, recommendRes, squadsRes] = await Promise.all([
        fetch("/api/personas"),
        fetch("/api/personas/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectDescription, mode }),
        }),
        fetch("/api/squads"),
      ]);
      const { personas: rawPersonas, savedIds: fetchedSavedIds } = await personasRes.json();
      const { recommended_ids } = await recommendRes.json();
      const validCategories = mode === "topic" ? ["general", "custom"] : ["technical", "product", "design", "end_user", "business", "custom"];
      const allPersonas = (rawPersonas || []).filter((p: PersonaData) => validCategories.includes(p.category));
      setPersonas(allPersonas);
      setSavedIds(new Set<string>(fetchedSavedIds || []));
      const recSet = new Set<string>(recommended_ids || []);
      setRecommendedIds(recSet);
      setSelectedIds(new Set((recommended_ids || []).slice(0, maxPersonas)));
      if (squadsRes.ok) {
        const { squads: fetched } = await squadsRes.json();
        setSquads(fetched || []);
      }
      setLoading(false);
    }
    load();
  }, [projectDescription, maxPersonas]);

  async function applySquad(squad: PersonaSquad) {
    const valid = squad.persona_ids.filter((id) => personas.some((p) => p.id === id));
    setSelectedIds(new Set(valid.slice(0, maxPersonas)));
    setActiveSquadId(squad.id);
  }

  async function saveCurrentAsSquad() {
    const name = squadNameDraft.trim();
    if (!name || selectedIds.size === 0) return;
    setSavingSquad(true);
    try {
      const res = await fetch("/api/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, personaIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        const { squad } = await res.json();
        setSquads((prev) => [squad, ...prev]);
        setActiveSquadId(squad.id);
        setShowSaveSquad(false);
        setSquadNameDraft("");
      }
    } finally {
      setSavingSquad(false);
    }
  }

  async function deleteSquad(id: string) {
    const prev = squads;
    setSquads((s) => s.filter((x) => x.id !== id));
    if (activeSquadId === id) setActiveSquadId(null);
    const res = await fetch(`/api/squads/${id}`, { method: "DELETE" });
    if (!res.ok) setSquads(prev);
  }

  const hasSaved = savedIds.size > 0;
  const hasCustom = personas.some((p) => p.is_custom);

  // Filtering logic
  const filtered = useMemo(() => {
    return personas.filter((p) => {
      if (activeCategory === "my_saved") {
        if (!savedIds.has(p.id)) return false;
      } else if (activeCategory === "my_custom") {
        if (!p.is_custom) return false;
      } else if (activeCategory) {
        if (p.category !== activeCategory) return false;
      } else {
        if (p.category === "custom") return false;
      }
      if (ageFilters.size > 0) {
        const matchesAge = Array.from(ageFilters).some((label) => {
          const range = ageRanges.find((r) => r.label === label);
          return range && p.demographics.age >= range.min && p.demographics.age <= range.max;
        });
        if (!matchesAge) return false;
      }
      if (genderFilters.size > 0 && !genderFilters.has(p.demographics.gender)) return false;
      if (incomeFilters.size > 0 && !incomeFilters.has(p.demographics.income_level)) return false;
      return true;
    });
  }, [personas, activeCategory, savedIds, ageFilters, genderFilters, incomeFilters]);

  function togglePersona(id: string) {
    setActiveSquadId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxPersonas) {
        next.add(id);
      }
      return next;
    });
  }

  function toggleFilter(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function clearAllFilters() {
    setActiveCategory(null);
    setAgeFilters(new Set());
    setGenderFilters(new Set());
    setIncomeFilters(new Set());
  }

  const hasActiveFilters = activeCategory || ageFilters.size > 0 || genderFilters.size > 0 || incomeFilters.size > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Sparkles className="mb-3 h-6 w-6 animate-pulse text-[#E2DDD5]" />
        <p className="text-sm text-[#9B9594]">{t("aiRecommending")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: count + confirm */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#9B9594]">
          {t("personaLimit", { max: maxPersonas, count: selectedIds.size })}
        </p>
        <Button
          onClick={() => onConfirm(Array.from(selectedIds))}
          disabled={disabled || selectedIds.size === 0}
          className="bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] font-semibold"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : t("startEvaluation")}
        </Button>
      </div>

      {/* Squads row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#666462] uppercase tracking-wide">
          <Bookmark className="h-3 w-3" />
          {t("squads")}
        </span>
        {squads.map((squad) => (
          <span
            key={squad.id}
            className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
              activeSquadId === squad.id
                ? "border-[#E2DDD5] bg-[#E2DDD5]/10 text-[#EAEAE8]"
                : "border-[#2A2A2A] bg-[#141414] text-[#9B9594] hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
            }`}
            onClick={() => applySquad(squad)}
          >
            <span className="max-w-[140px] truncate">{squad.name}</span>
            <span className="text-[#666462]">·{squad.persona_ids.length}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteSquad(squad.id);
              }}
              className="ml-0.5 text-[#666462] hover:text-[#F87171] opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={t("squadDelete")}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={selectedIds.size === 0}
          onClick={() => setShowSaveSquad(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#3A3A3A] px-2.5 py-1 text-xs text-[#9B9594] hover:border-[#E2DDD5] hover:text-[#EAEAE8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + {t("saveSquad")}
        </button>
      </div>

      {showSaveSquad && (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-3 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={squadNameDraft}
            onChange={(e) => setSquadNameDraft(e.target.value.slice(0, 60))}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") saveCurrentAsSquad();
              if (e.key === "Escape") {
                setShowSaveSquad(false);
                setSquadNameDraft("");
              }
            }}
            placeholder={t("squadNamePlaceholder")}
            className="flex-1 bg-[#0C0C0C] border border-[#2A2A2A] rounded px-3 py-1.5 text-sm text-[#EAEAE8] placeholder:text-[#666462] focus:outline-none focus:border-[#3A3A3A]"
          />
          <Button
            size="sm"
            onClick={saveCurrentAsSquad}
            disabled={!squadNameDraft.trim() || savingSquad}
            className="bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C]"
          >
            {savingSquad ? <Loader2 className="h-3 w-3 animate-spin" /> : tCommon("save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowSaveSquad(false);
              setSquadNameDraft("");
            }}
            className="text-[#9B9594]"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activeCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory(null)}
          className={activeCategory === null ? "bg-[#E2DDD5] text-[#0C0C0C] hover:bg-[#D4CFC7]" : "border-[#2A2A2A] text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"}
        >
          {t("allCategories")}
        </Button>
        {hasSaved && (
          <Button
            variant={activeCategory === "my_saved" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(activeCategory === "my_saved" ? null : "my_saved")}
            className={activeCategory === "my_saved" ? "bg-[#C4A882] text-[#0C0C0C] hover:bg-[#D4B892]" : "border-[#C4A882]/30 text-[#C4A882] hover:bg-[#C4A882]/10 hover:text-[#D4B892]"}
          >
            <Heart className="mr-1 h-3 w-3" />
            {locale === "zh" ? "已收藏" : "My Saved"}
          </Button>
        )}
        {hasCustom && (
          <Button
            variant={activeCategory === "my_custom" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(activeCategory === "my_custom" ? null : "my_custom")}
            className={activeCategory === "my_custom" ? "bg-[#C4A882] text-[#0C0C0C] hover:bg-[#D4B892]" : "border-[#C4A882]/30 text-[#C4A882] hover:bg-[#C4A882]/10 hover:text-[#D4B892]"}
          >
            <User className="mr-1 h-3 w-3" />
            {locale === "zh" ? "我的自定义" : "My Custom"}
          </Button>
        )}
        {categoryOrder.length > 1 && (
          <>
            <span className="mx-0.5 h-4 w-px bg-[#2A2A2A]" />
            {categoryOrder.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={activeCategory === cat ? "bg-[#E2DDD5] text-[#0C0C0C] hover:bg-[#D4CFC7]" : "border-[#2A2A2A] text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"}
              >
                {categoryLabels[cat]?.[locale] || cat}
              </Button>
            ))}
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="ml-auto text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C]"
        >
          <Filter className="mr-1 h-3.5 w-3.5" />
          {t("filterByTrait")}
          {showFilters ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#1C1C1C]/50 p-4 space-y-3">
          {/* Age */}
          <div>
            <span className="text-xs font-semibold text-[#666462] uppercase">{t("ageRange")}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ageRanges.map((range) => (
                <Button
                  key={range.label}
                  variant={ageFilters.has(range.label) ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs ${ageFilters.has(range.label) ? "bg-[#E2DDD5] text-[#0C0C0C]" : "border-[#2A2A2A] text-[#9B9594]"}`}
                  onClick={() => toggleFilter(ageFilters, range.label, setAgeFilters)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Gender */}
          <div>
            <span className="text-xs font-semibold text-[#666462] uppercase">Gender</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["M", "F", "NB"].map((g) => (
                <Button
                  key={g}
                  variant={genderFilters.has(g) ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs ${genderFilters.has(g) ? "bg-[#E2DDD5] text-[#0C0C0C]" : "border-[#2A2A2A] text-[#9B9594]"}`}
                  onClick={() => toggleFilter(genderFilters, g, setGenderFilters)}
                >
                  {genderLabels[g]?.[locale] || g}
                </Button>
              ))}
            </div>
          </div>
          {/* Income */}
          <div>
            <span className="text-xs font-semibold text-[#666462] uppercase">Income</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["low", "medium", "medium_high", "high", "very_high"].map((inc) => (
                <Button
                  key={inc}
                  variant={incomeFilters.has(inc) ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs ${incomeFilters.has(inc) ? "bg-[#E2DDD5] text-[#0C0C0C]" : "border-[#2A2A2A] text-[#9B9594]"}`}
                  onClick={() => toggleFilter(incomeFilters, inc, setIncomeFilters)}
                >
                  {incomeLabels[inc]?.[locale] || inc}
                </Button>
              ))}
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-xs text-[#9B9594]" onClick={clearAllFilters}>
              {t("clearFilters")}
            </Button>
          )}
        </div>
      )}

      {/* Persona count */}
      <p className="text-xs text-[#666462]">
        {t("personasFound", { count: filtered.length })}
      </p>

      {/* Persona grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((persona) => {
          const isSelected = selectedIds.has(persona.id);
          const isRecommended = recommendedIds.has(persona.id);
          const isSaved = savedIds.has(persona.id);
          const isCustom = persona.is_custom;
          const localized = persona.identity.locale_variants[locale as "zh" | "en"] || persona.identity.locale_variants.en;
          const tags = persona.identity.tags;

          return (
            <div key={persona.id} className="relative group">
              <Card
                className={`cursor-pointer transition-all border-[#2A2A2A] bg-[#141414] ${
                  isSelected ? "border-[#E2DDD5] ring-2 ring-[#E2DDD5]/20" : "hover:border-[#3A3A3A]"
                }`}
                onClick={() => togglePersona(persona.id)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
                    {persona.identity.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-[#EAEAE8] truncate">{localized.name}</span>
                      {isCustom && <User className="h-3 w-3 shrink-0 text-[#C4A882]" />}
                      {isSaved && <Heart className="h-3 w-3 shrink-0 text-[#C4A882]" />}
                      {isRecommended && <Sparkles className="h-3 w-3 shrink-0 text-[#E2DDD5]" />}
                      {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-[#E2DDD5]" />}
                    </div>
                    <p className="mt-0.5 text-xs text-[#666462] truncate">
                      {persona.demographics.occupation && localized.tagline
                        ? `${persona.demographics.occupation} · ${localized.tagline}`
                        : persona.demographics.occupation || localized.tagline || (tags && tags.length > 0 ? tags.slice(0, 2).join(" · ") : "")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Hover profile card */}
              <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 scale-95 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0">
                <div className="rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] p-4 shadow-xl shadow-black/40">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#141414] text-lg">
                      {persona.identity.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[#EAEAE8]">{localized.name}</p>
                      <p className="text-[11px] text-[#666462]">{persona.demographics.occupation}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#9B9594] italic mb-2">"{localized.tagline}"</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#666462]">
                    <span>{persona.demographics.age}{locale === "zh" ? "岁" : "y/o"} · {genderLabels[persona.demographics.gender]?.[locale] || persona.demographics.gender}</span>
                    <span>{persona.demographics.occupation}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-[#9B9594] leading-relaxed line-clamp-2">
                    {persona.evaluation_lens.primary_question}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Introduction section */}
      <div className="rounded-lg border border-[#2A2A2A] bg-[#141414]/60 px-4 py-3">
        <p className="text-xs text-[#9B9594] leading-relaxed">
          {mode === "product" ? t("personaIntroProduct") : t("personaIntroTopic")}
        </p>
      </div>
    </div>
  );
}
