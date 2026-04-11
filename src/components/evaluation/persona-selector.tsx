"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ChevronDown, ChevronUp, Filter, Loader2 } from "lucide-react";

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
  const locale = useLocale();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [ageFilters, setAgeFilters] = useState<Set<string>>(new Set());
  const [genderFilters, setGenderFilters] = useState<Set<string>>(new Set());
  const [incomeFilters, setIncomeFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const [personasRes, recommendRes] = await Promise.all([
        fetch("/api/personas"),
        fetch("/api/personas/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectDescription, mode }),
        }),
      ]);
      const { personas: rawPersonas } = await personasRes.json();
      const { recommended_ids } = await recommendRes.json();
      const validCategories = mode === "topic" ? ["general"] : ["technical", "product", "design", "end_user", "business"];
      const allPersonas = (rawPersonas || []).filter((p: PersonaData) => validCategories.includes(p.category));
      setPersonas(allPersonas);
      const recSet = new Set<string>(recommended_ids || []);
      setRecommendedIds(recSet);
      setSelectedIds(new Set((recommended_ids || []).slice(0, maxPersonas)));
      setLoading(false);
    }
    load();
  }, [projectDescription, maxPersonas]);

  // Filtering logic
  const filtered = useMemo(() => {
    return personas.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
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
  }, [personas, activeCategory, ageFilters, genderFilters, incomeFilters]);

  function togglePersona(id: string) {
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

      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {categoryOrder.length > 1 && (
          <>
            <Button
              variant={activeCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(null)}
              className={activeCategory === null ? "bg-[#E2DDD5] text-[#0C0C0C] hover:bg-[#D4CFC7]" : "border-[#2A2A2A] text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"}
            >
              {t("allCategories")}
            </Button>
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
          const localized = persona.identity.locale_variants[locale as "zh" | "en"] || persona.identity.locale_variants.en;
          const tags = persona.identity.tags;

          return (
            <Card
              key={persona.id}
              className={`cursor-pointer transition-all border-[#2A2A2A] bg-[#141414] ${
                isSelected ? "border-[#E2DDD5] ring-2 ring-[#E2DDD5]/20" : "hover:border-[#3A3A3A]"
              }`}
              onClick={() => togglePersona(persona.id)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
                  {persona.identity.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate text-[#EAEAE8]">{localized.name}</span>
                    {isRecommended && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 bg-[#E2DDD5]/10 text-[#E2DDD5] border-[#E2DDD5]/20">
                        {t("recommended")}
                      </Badge>
                    )}
                    {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-[#E2DDD5]" />}
                  </div>
                  {tags && tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-block rounded-full bg-[#1C1C1C] px-2 py-0.5 text-[10px] text-[#9B9594]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-[#666462] truncate">{localized.tagline}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
