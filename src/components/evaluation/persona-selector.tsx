"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ChevronDown, ChevronUp, Filter } from "lucide-react";

interface PersonaData {
  id: string;
  identity: {
    name: string;
    avatar: string;
    tagline: string;
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
}

const categoryOrder = ["technical", "product", "design", "end_user", "business"];
const categoryLabels: Record<string, Record<string, string>> = {
  technical: { zh: "技术", en: "Technical" },
  product: { zh: "产品", en: "Product" },
  design: { zh: "设计", en: "Design" },
  end_user: { zh: "用户", en: "End User" },
  business: { zh: "商业", en: "Business" },
};

const ageRanges = [
  { label: "18-24", min: 18, max: 24 },
  { label: "25-34", min: 25, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45-54", min: 45, max: 54 },
  { label: "55+", min: 55, max: 120 },
];

const genderLabels: Record<string, Record<string, string>> = {
  M: { zh: "男", en: "Male" },
  F: { zh: "女", en: "Female" },
  NB: { zh: "非二元", en: "Non-binary" },
};

const incomeLabels: Record<string, Record<string, string>> = {
  low: { zh: "低", en: "Low" },
  medium: { zh: "中等", en: "Medium" },
  medium_high: { zh: "中高", en: "Mid-High" },
  high: { zh: "高", en: "High" },
  very_high: { zh: "极高", en: "Very High" },
};

export function PersonaSelector({ projectDescription, maxPersonas, onConfirm, disabled }: PersonaSelectorProps) {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string | null>(null); // null = all
  const [showFilters, setShowFilters] = useState(false);
  const [ageFilters, setAgeFilters] = useState<Set<string>>(new Set()); // set of range labels
  const [genderFilters, setGenderFilters] = useState<Set<string>>(new Set());
  const [incomeFilters, setIncomeFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const [personasRes, recommendRes] = await Promise.all([
        fetch("/api/personas"),
        fetch("/api/personas/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectDescription }),
        }),
      ]);
      const { personas: allPersonas } = await personasRes.json();
      const { recommended_ids } = await recommendRes.json();
      setPersonas(allPersonas || []);
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
        <Sparkles className="mb-3 h-6 w-6 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">{t("aiRecommending")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: count + confirm */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("personaLimit", { max: maxPersonas, count: selectedIds.size })}
        </p>
        <Button onClick={() => onConfirm(Array.from(selectedIds))} disabled={disabled || selectedIds.size === 0}>
          {t("startEvaluation")}
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activeCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory(null)}
        >
          {t("allCategories")}
        </Button>
        {categoryOrder.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
          >
            {categoryLabels[cat]?.[locale] || cat}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="ml-auto"
        >
          <Filter className="mr-1 h-3.5 w-3.5" />
          {t("filterByTrait")}
          {showFilters ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          {/* Age */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">{t("ageRange")}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ageRanges.map((range) => (
                <Button
                  key={range.label}
                  variant={ageFilters.has(range.label) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleFilter(ageFilters, range.label, setAgeFilters)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Gender */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Gender</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["M", "F", "NB"].map((g) => (
                <Button
                  key={g}
                  variant={genderFilters.has(g) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleFilter(genderFilters, g, setGenderFilters)}
                >
                  {genderLabels[g]?.[locale] || g}
                </Button>
              ))}
            </div>
          </div>
          {/* Income */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Income</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["low", "medium", "medium_high", "high", "very_high"].map((inc) => (
                <Button
                  key={inc}
                  variant={incomeFilters.has(inc) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleFilter(incomeFilters, inc, setIncomeFilters)}
                >
                  {incomeLabels[inc]?.[locale] || inc}
                </Button>
              ))}
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearAllFilters}>
              {t("clearFilters")}
            </Button>
          )}
        </div>
      )}

      {/* Persona count */}
      <p className="text-xs text-muted-foreground">
        {t("personasFound", { count: filtered.length })}
      </p>

      {/* Persona grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((persona) => {
          const isSelected = selectedIds.has(persona.id);
          const isRecommended = recommendedIds.has(persona.id);
          const localized = persona.identity.locale_variants[locale as "zh" | "en"] || persona.identity.locale_variants.en;

          return (
            <Card
              key={persona.id}
              className={`cursor-pointer transition-all ${
                isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-foreground/20"
              }`}
              onClick={() => togglePersona(persona.id)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                  {persona.identity.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{localized.name}</span>
                    {isRecommended && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                        {t("recommended")}
                      </Badge>
                    )}
                    {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{localized.tagline}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
