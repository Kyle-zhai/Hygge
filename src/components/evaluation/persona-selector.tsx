"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check, Sparkles, ChevronDown, ChevronUp, Loader2, Bookmark, X, Heart, User,
  Wrench, TrendingUp, Lightbulb, Shield,
  HeartPulse, Users, Brain, Cog,
  SlidersHorizontal, CalendarRange, UserRound, Wallet,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  DOMAINS, getSubDomainsForDomain, getSubDomain, localizedLabel,
  PRODUCT_CATEGORIES, getProductCategory,
  type DomainKey, type SubDomainKey, type ProductCategoryKey,
} from "@/lib/personas/taxonomy";

// Module-level icon maps — keep outside the component so they don't recreate on render.
const PRODUCT_CATEGORY_ICONS: Record<ProductCategoryKey, LucideIcon> = {
  utility: Wrench,
  market: TrendingUp,
  novelty: Lightbulb,
  reliability: Shield,
};

const TOPIC_DOMAIN_ICONS: Record<DomainKey, LucideIcon> = {
  physical: HeartPulse,
  social: Users,
  intellectual: Brain,
  utility: Cog,
};

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
  domain?: DomainKey | null;
  sub_domain?: SubDomainKey | null;
  dimensions?: string[];
  product_category?: ProductCategoryKey | null;
  product_traits?: string[];
}

const PAGE_SIZE = 15;

interface PersonaSelectorProps {
  projectDescription: string;
  maxPersonas: number;
  onConfirm: (selectedIds: string[]) => void;
  disabled?: boolean;
  mode?: "topic" | "product";
}

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
  const t = useTranslations("evaluation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [preferredIds, setPreferredIds] = useState<Set<string>>(new Set());
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

  // Topic-mode hierarchical filter (progressive, personas always visible)
  const [selectedDomain, setSelectedDomain] = useState<DomainKey | null>(null);
  const [selectedSubDomain, setSelectedSubDomain] = useState<SubDomainKey | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<Set<string>>(new Set());
  const isTopic = mode === "topic";

  // Product-mode progressive filter (category → optional traits)
  const [selectedProductCategory, setSelectedProductCategory] = useState<ProductCategoryKey | null>(null);
  const [selectedProductTraits, setSelectedProductTraits] = useState<Set<string>>(new Set());

  // Pagination: only render this many personas; "Show more" reveals PAGE_SIZE more.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
      const { personas: rawPersonas, savedIds: fetchedSavedIds, preferredIds: fetchedPreferredIds } = await personasRes.json();
      const { recommended_ids } = await recommendRes.json();
      const validCategories = mode === "topic" ? ["general", "custom"] : ["technical", "product", "design", "end_user", "business", "custom"];
      const allPersonas = (rawPersonas || []).filter((p: PersonaData) => validCategories.includes(p.category));
      setPersonas(allPersonas);
      setSavedIds(new Set<string>(fetchedSavedIds || []));
      setPreferredIds(new Set<string>(fetchedPreferredIds || []));
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

  // Filtering logic — category tags and demographic filters apply together.
  const filtered = useMemo(() => {
    const pool = personas.filter((p) => {
      if (isTopic) {
        if (activeCategory === "my_saved") {
          if (!savedIds.has(p.id)) return false;
        } else if (activeCategory === "my_custom") {
          if (!p.is_custom) return false;
        } else {
          if (selectedDomain && p.domain !== selectedDomain) return false;
          if (selectedSubDomain && p.sub_domain !== selectedSubDomain) return false;
          if (selectedDimensions.size > 0) {
            const personaDims = new Set(p.dimensions ?? []);
            const anyMatch = Array.from(selectedDimensions).some((d) => personaDims.has(d));
            if (!anyMatch) return false;
          }
        }
      } else {
        if (activeCategory === "my_saved") {
          if (!savedIds.has(p.id)) return false;
        } else if (activeCategory === "my_custom") {
          if (!p.is_custom) return false;
        } else {
          if (p.category === "custom") return false;
          if (selectedProductCategory && p.product_category !== selectedProductCategory) return false;
          if (selectedProductTraits.size > 0) {
            const personaTraits = new Set(p.product_traits ?? []);
            const anyMatch = Array.from(selectedProductTraits).some((tr) => personaTraits.has(tr));
            if (!anyMatch) return false;
          }
        }
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
    // Sort: preferred personas (thumbs-up history) first, then recommended,
    // then saved, then the rest — stable within each bucket.
    return pool.slice().sort((a, b) => {
      const score = (p: PersonaData) =>
        (preferredIds.has(p.id) ? 4 : 0) +
        (recommendedIds.has(p.id) ? 2 : 0) +
        (savedIds.has(p.id) ? 1 : 0);
      return score(b) - score(a);
    });
  }, [personas, isTopic, activeCategory, savedIds, preferredIds, recommendedIds, selectedDomain, selectedSubDomain, selectedDimensions, selectedProductCategory, selectedProductTraits, ageFilters, genderFilters, incomeFilters]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [isTopic, activeCategory, selectedDomain, selectedSubDomain, selectedDimensions, selectedProductCategory, selectedProductTraits, ageFilters, genderFilters, incomeFilters]);

  // Topic drill-down: clicking an already-selected item deselects it and clears deeper levels.
  function pickDomain(domain: DomainKey) {
    if (selectedDomain === domain) {
      setSelectedDomain(null);
      setSelectedSubDomain(null);
      setSelectedDimensions(new Set());
    } else {
      setSelectedDomain(domain);
      setSelectedSubDomain(null);
      setSelectedDimensions(new Set());
    }
  }
  function pickSubDomain(subDomain: SubDomainKey) {
    if (selectedSubDomain === subDomain) {
      setSelectedSubDomain(null);
      setSelectedDimensions(new Set());
    } else {
      setSelectedSubDomain(subDomain);
      setSelectedDimensions(new Set());
    }
  }
  function toggleDimension(key: string) {
    setSelectedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function pickProductCategory(cat: ProductCategoryKey) {
    if (selectedProductCategory === cat) {
      setSelectedProductCategory(null);
      setSelectedProductTraits(new Set());
    } else {
      setSelectedProductCategory(cat);
      setSelectedProductTraits(new Set());
    }
  }
  function toggleProductTrait(key: string) {
    setSelectedProductTraits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    setSelectedDomain(null);
    setSelectedSubDomain(null);
    setSelectedDimensions(new Set());
    setSelectedProductCategory(null);
    setSelectedProductTraits(new Set());
    setAgeFilters(new Set());
    setGenderFilters(new Set());
    setIncomeFilters(new Set());
  }

  const demographicFilterCount = ageFilters.size + genderFilters.size + incomeFilters.size;
  const hasActiveFilters = !!(
    activeCategory || selectedDomain || selectedSubDomain || selectedDimensions.size > 0 ||
    selectedProductCategory || selectedProductTraits.size > 0 ||
    demographicFilterCount > 0
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Sparkles className="mb-3 h-6 w-6 animate-pulse text-[color:var(--accent-primary)]" />
        <p className="text-sm text-[color:var(--text-secondary)]">{t("aiRecommending")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: count + confirm */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--text-secondary)]">
          {t("personaLimit", { max: maxPersonas, count: selectedIds.size })}
        </p>
        <Button
          onClick={() => onConfirm(Array.from(selectedIds))}
          disabled={disabled || selectedIds.size === 0}
          className="bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--bg-primary)] font-semibold"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : t("startEvaluation")}
        </Button>
      </div>

      {/* Squads row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wide">
          <Bookmark className="h-3 w-3" />
          {t("squads")}
        </span>
        {squads.map((squad) => (
          <span
            key={squad.id}
            className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
              activeSquadId === squad.id
                ? "border-[color:var(--accent-primary)] bg-[rgb(var(--accent-primary-rgb)/0.10)] text-[color:var(--text-primary)]"
                : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
            }`}
            onClick={() => applySquad(squad)}
          >
            <span className="max-w-[140px] truncate">{squad.name}</span>
            <span className="text-[color:var(--text-tertiary)]">·{squad.persona_ids.length}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteSquad(squad.id);
              }}
              className="ml-0.5 text-[color:var(--text-tertiary)] hover:text-[#F87171] opacity-0 group-hover:opacity-100 transition-opacity"
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
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-hover)] px-2.5 py-1 text-xs text-[color:var(--text-secondary)] hover:border-[color:var(--accent-primary)] hover:text-[color:var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + {t("saveSquad")}
        </button>
      </div>

      {showSaveSquad && (
        <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-3 flex items-center gap-2">
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
            className="flex-1 bg-[color:var(--bg-primary)] border border-[color:var(--border-default)] rounded px-3 py-1.5 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-[color:var(--border-hover)]"
          />
          <Button
            size="sm"
            onClick={saveCurrentAsSquad}
            disabled={!squadNameDraft.trim() || savingSquad}
            className="bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--bg-primary)]"
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
            className="text-[color:var(--text-secondary)]"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      )}

      {/* Shortcuts + demographic filter toggle — always visible at top */}
      <div className="flex flex-wrap items-center gap-2">
        {(hasSaved || hasCustom) && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--bg-secondary)] border border-[color:var(--border-default)] p-1">
            {hasSaved && (
              <button
                type="button"
                onClick={() => setActiveCategory(activeCategory === "my_saved" ? null : "my_saved")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activeCategory === "my_saved"
                    ? "bg-[color:var(--accent-warm)] text-[color:var(--bg-primary)] shadow-sm"
                    : "text-[color:var(--accent-warm)] hover:bg-[rgb(var(--accent-warm-rgb)/0.10)]"
                }`}
                aria-pressed={activeCategory === "my_saved"}
              >
                <Heart className={`h-3.5 w-3.5 ${activeCategory === "my_saved" ? "fill-current" : ""}`} />
                {locale === "zh" ? "已收藏" : "My Saved"}
              </button>
            )}
            {hasCustom && (
              <button
                type="button"
                onClick={() => setActiveCategory(activeCategory === "my_custom" ? null : "my_custom")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activeCategory === "my_custom"
                    ? "bg-[color:var(--accent-warm)] text-[color:var(--bg-primary)] shadow-sm"
                    : "text-[color:var(--accent-warm)] hover:bg-[rgb(var(--accent-warm-rgb)/0.10)]"
                }`}
                aria-pressed={activeCategory === "my_custom"}
              >
                <User className="h-3.5 w-3.5" />
                {locale === "zh" ? "我的自定义" : "My Custom"}
              </button>
            )}
          </div>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            {locale === "zh" ? "清除筛选" : "Clear filters"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            showFilters
              ? "border-[rgb(var(--accent-primary-rgb)/0.40)] bg-[rgb(var(--accent-primary-rgb)/0.05)] text-[color:var(--text-primary)]"
              : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
          }`}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {locale === "zh" ? "人口特征" : "Demographics"}
          {demographicFilterCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-[color:var(--accent-warm)] text-[10px] font-semibold text-[color:var(--bg-primary)] px-1">
              {demographicFilterCount}
            </span>
          )}
          {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Category tag rows — progressive drill-down, personas always visible below.
          Hidden when user jumps to My Saved / My Custom so those lists aren't further filtered. */}
      {!activeCategory && (
        isTopic ? (
          <TopicFilterRows
            selectedDomain={selectedDomain}
            selectedSubDomain={selectedSubDomain}
            selectedDimensions={selectedDimensions}
            locale={locale}
            onPickDomain={pickDomain}
            onPickSubDomain={pickSubDomain}
            onToggleDimension={toggleDimension}
          />
        ) : (
          <ProductFilterRows
            selectedCategory={selectedProductCategory}
            selectedTraits={selectedProductTraits}
            locale={locale}
            onPickCategory={pickProductCategory}
            onToggleTrait={toggleProductTrait}
          />
        )
      )}

      {/* Expandable filters — demographic overlay (age / gender / income) */}
      {showFilters && (
        <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4 space-y-4">
          {/* Age */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide">
              <CalendarRange className="h-3 w-3 text-[color:var(--text-tertiary)]" />
              {locale === "zh" ? "年龄段" : t("ageRange")}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ageRanges.map((range) => {
                const active = ageFilters.has(range.label);
                return (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => toggleFilter(ageFilters, range.label, setAgeFilters)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? "border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] text-[color:var(--bg-primary)]"
                        : "border-[color:var(--border-default)] bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Gender */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide">
              <UserRound className="h-3 w-3 text-[color:var(--text-tertiary)]" />
              {locale === "zh" ? "性别" : "Gender"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["M", "F", "NB"].map((g) => {
                const active = genderFilters.has(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleFilter(genderFilters, g, setGenderFilters)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? "border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] text-[color:var(--bg-primary)]"
                        : "border-[color:var(--border-default)] bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    {genderLabels[g]?.[locale] || g}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Income */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide">
              <Wallet className="h-3 w-3 text-[color:var(--text-tertiary)]" />
              {locale === "zh" ? "收入水平" : "Income"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["low", "medium", "medium_high", "high", "very_high"].map((inc) => {
                const active = incomeFilters.has(inc);
                return (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => toggleFilter(incomeFilters, inc, setIncomeFilters)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? "border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] text-[color:var(--bg-primary)]"
                        : "border-[color:var(--border-default)] bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    {incomeLabels[inc]?.[locale] || inc}
                  </button>
                );
              })}
            </div>
          </div>
          {demographicFilterCount > 0 && (
            <div className="flex justify-end pt-1 border-t border-[color:var(--border-default)]">
              <button
                type="button"
                onClick={() => {
                  setAgeFilters(new Set());
                  setGenderFilters(new Set());
                  setIncomeFilters(new Set());
                }}
                className="inline-flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
              >
                <X className="h-3 w-3" />
                {locale === "zh" ? "清除人口特征" : "Clear demographics"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Persona count + grid — always visible, filtered in real time */}
      <p className="text-xs text-[color:var(--text-tertiary)]">
        {t("personasFound", { count: filtered.length })}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, visibleCount).map((persona) => {
          const isSelected = selectedIds.has(persona.id);
          const isRecommended = recommendedIds.has(persona.id);
          const isSaved = savedIds.has(persona.id);
          const isPreferred = preferredIds.has(persona.id);
          const isCustom = persona.is_custom;
          const localized = persona.identity.locale_variants[locale as "zh" | "en"] || persona.identity.locale_variants.en;
          const tags = persona.identity.tags;

          return (
            <div key={persona.id} className="relative group">
              <Card
                className={`cursor-pointer transition-all border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] ${
                  isSelected ? "border-[color:var(--accent-primary)] ring-2 ring-[rgb(var(--accent-primary-rgb)/0.20)]" : "hover:border-[color:var(--border-hover)]"
                }`}
                onClick={() => togglePersona(persona.id)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-tertiary)] text-lg">
                    {persona.identity.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-[color:var(--text-primary)] truncate">{localized.name}</span>
                      {isCustom && <User className="h-3 w-3 shrink-0 text-[color:var(--accent-warm)]" />}
                      {isPreferred && (
                        <Star
                          className="h-3 w-3 shrink-0 fill-[color:var(--accent-warm)] text-[color:var(--accent-warm)]"
                          aria-label={locale === "zh" ? "你偏好的视角" : "You preferred"}
                        />
                      )}
                      {isSaved && <Heart className="h-3 w-3 shrink-0 text-[color:var(--accent-warm)]" />}
                      {isRecommended && <Sparkles className="h-3 w-3 shrink-0 text-[color:var(--accent-primary)]" />}
                      {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-[color:var(--accent-primary)]" />}
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--text-tertiary)] truncate">
                      {persona.demographics.occupation && localized.tagline
                        ? `${persona.demographics.occupation} · ${localized.tagline}`
                        : persona.demographics.occupation || localized.tagline || (tags && tags.length > 0 ? tags.slice(0, 2).join(" · ") : "")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Hover profile card */}
              <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 scale-95 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0">
                <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] p-4 shadow-xl shadow-black/40">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-secondary)] text-lg">
                      {persona.identity.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[color:var(--text-primary)]">{localized.name}</p>
                      <p className="text-[11px] text-[color:var(--text-tertiary)]">{persona.demographics.occupation}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[color:var(--text-secondary)] italic mb-2">&ldquo;{localized.tagline}&rdquo;</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[color:var(--text-tertiary)]">
                    <span>{persona.demographics.age}{locale === "zh" ? "岁" : "y/o"} · {genderLabels[persona.demographics.gender]?.[locale] || persona.demographics.gender}</span>
                    <span>{persona.demographics.occupation}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)] leading-relaxed line-clamp-2">
                    {persona.evaluation_lens.primary_question}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > visibleCount && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="border-[color:var(--border-default)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
          >
            <ChevronDown className="mr-1 h-3.5 w-3.5" />
            {locale === "zh"
              ? `显示更多（还有 ${filtered.length - visibleCount} 个）`
              : `Show more (${filtered.length - visibleCount} left)`}
          </Button>
        </div>
      )}

      {/* Introduction section */}
      <div className="rounded-lg border border-[color:var(--border-default)] bg-[rgb(var(--bg-secondary-rgb)/0.60)] px-4 py-3">
        <p className="text-xs text-[color:var(--text-secondary)] leading-relaxed">
          {mode === "product" ? t("personaIntroProduct") : t("personaIntroTopic")}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// TopicFilterRows — inline progressive filter for topic mode.
// Each row reveals the next level; personas stay visible in the grid below.
// ────────────────────────────────────────────────────────────────────

interface TopicFilterRowsProps {
  selectedDomain: DomainKey | null;
  selectedSubDomain: SubDomainKey | null;
  selectedDimensions: Set<string>;
  locale: string;
  onPickDomain: (domain: DomainKey) => void;
  onPickSubDomain: (subDomain: SubDomainKey) => void;
  onToggleDimension: (key: string) => void;
}

function TopicFilterRows({
  selectedDomain, selectedSubDomain, selectedDimensions, locale,
  onPickDomain, onPickSubDomain, onToggleDimension,
}: TopicFilterRowsProps) {
  const zh = locale === "zh";
  const subDomains = selectedDomain ? getSubDomainsForDomain(selectedDomain) : [];
  const subDomainObj = selectedSubDomain ? getSubDomain(selectedSubDomain) : undefined;

  return (
    <div className="space-y-2.5">
      {/* Level 1: Domains — always visible */}
      <div className="flex flex-wrap gap-1.5">
        {DOMAINS.map((d) => {
          const active = selectedDomain === d.key;
          const Icon = TOPIC_DOMAIN_ICONS[d.key];
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onPickDomain(d.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-[color:var(--accent-primary)] bg-[rgb(var(--accent-primary-rgb)/0.10)] text-[color:var(--text-primary)] shadow-sm"
                  : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
              }`}
            >
              {active ? <Check className="h-3 w-3" /> : <Icon className="h-3.5 w-3.5" />}
              {localizedLabel(d, locale)}
            </button>
          );
        })}
      </div>

      {/* Level 2: Sub-domains — visible once a domain is picked */}
      {selectedDomain && subDomains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-3 border-l-2 border-[color:var(--border-default)]">
          {subDomains.map((s) => {
            const active = selectedSubDomain === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onPickSubDomain(s.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  active
                    ? "border-[color:var(--accent-warm)] bg-[rgb(var(--accent-warm-rgb)/0.10)] text-[color:var(--text-primary)]"
                    : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                {localizedLabel(s, locale)}
              </button>
            );
          })}
        </div>
      )}

      {/* Level 3: Dimensions (multi-select) — visible once a sub-domain is picked */}
      {subDomainObj && subDomainObj.dimensions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-3 border-l-2 border-[color:var(--border-default)]">
          <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-tertiary)]">
            {zh ? "维度（可多选）" : "Dimensions (multi)"}
          </span>
          {subDomainObj.dimensions.map((d) => {
            const active = selectedDimensions.has(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onToggleDimension(d.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  active
                    ? "border-[color:var(--accent-primary)] bg-[rgb(var(--accent-primary-rgb)/0.10)] text-[color:var(--text-primary)]"
                    : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                {localizedLabel(d, locale)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ProductFilterRows — inline progressive filter for product mode.
// ────────────────────────────────────────────────────────────────────

interface ProductFilterRowsProps {
  selectedCategory: ProductCategoryKey | null;
  selectedTraits: Set<string>;
  locale: string;
  onPickCategory: (cat: ProductCategoryKey) => void;
  onToggleTrait: (key: string) => void;
}

function ProductFilterRows({
  selectedCategory, selectedTraits, locale, onPickCategory, onToggleTrait,
}: ProductFilterRowsProps) {
  const zh = locale === "zh";
  const categoryObj = selectedCategory ? getProductCategory(selectedCategory) : undefined;

  return (
    <div className="space-y-2.5">
      {/* Level 1: Categories — always visible, slightly richer pills with description */}
      <div className="flex flex-wrap gap-1.5">
        {PRODUCT_CATEGORIES.map((c) => {
          const active = selectedCategory === c.key;
          const Icon = PRODUCT_CATEGORY_ICONS[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPickCategory(c.key)}
              title={zh ? c.description_zh : c.description_en}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-[color:var(--accent-primary)] bg-[rgb(var(--accent-primary-rgb)/0.10)] text-[color:var(--text-primary)] shadow-sm"
                  : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
              }`}
            >
              {active ? <Check className="h-3 w-3" /> : <Icon className="h-3.5 w-3.5" />}
              {localizedLabel(c, locale)}
            </button>
          );
        })}
      </div>

      {/* Level 2: Traits (multi-select) — visible once a category is picked */}
      {categoryObj && (
        <div className="flex flex-wrap items-center gap-1.5 pl-3 border-l-2 border-[color:var(--border-default)]">
          <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-tertiary)]">
            {zh ? "细化标签（可多选）" : "Traits (multi)"}
          </span>
          {categoryObj.traits.map((tr) => {
            const active = selectedTraits.has(tr.key);
            return (
              <button
                key={tr.key}
                type="button"
                onClick={() => onToggleTrait(tr.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  active
                    ? "border-[color:var(--accent-warm)] bg-[rgb(var(--accent-warm-rgb)/0.10)] text-[color:var(--text-primary)]"
                    : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                {localizedLabel(tr, locale)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

