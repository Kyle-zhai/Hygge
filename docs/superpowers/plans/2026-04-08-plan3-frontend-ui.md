# Plan 3: Frontend UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all frontend pages — Dashboard, New Evaluation (ChatGPT-style input + persona selection), Evaluation Progress (realtime), Evaluation Results (persona cards + deep report), Pricing, and Settings.

**Architecture:** Next.js 16 App Router pages, mix of Server Components (data fetching) and Client Components (interactivity). Supabase Realtime for live progress. All UI via Shadcn/UI + Tailwind CSS + Framer Motion. i18n via next-intl (zh/en, zh default).

**Tech Stack:** Next.js 16, React 19, Shadcn/UI, Tailwind CSS v4, Framer Motion, Supabase Realtime, next-intl

---

## File Structure

```
src/
├── components/
│   ├── evaluation/
│   │   ├── project-input.tsx         # ChatGPT-style input box (client)
│   │   ├── persona-selector.tsx      # Persona grid with categories + selection (client)
│   │   ├── progress-tracker.tsx      # Realtime progress display (client)
│   │   ├── persona-review-card.tsx   # Single persona review card (server)
│   │   ├── score-radar.tsx           # 6-dimension score radar/bar chart (client)
│   │   └── report-section.tsx        # Reusable report section wrapper (server)
│   ├── dashboard/
│   │   ├── project-list.tsx          # List of projects with evaluation status (server)
│   │   ├── project-card.tsx          # Single project card (server)
│   │   └── usage-bar.tsx             # Subscription usage indicator (server)
│   ├── pricing/
│   │   └── plan-card.tsx             # Single pricing plan card (server)
│   └── settings/
│       └── profile-form.tsx          # Profile + locale settings form (client)
├── app/[locale]/
│   ├── (app)/
│   │   ├── dashboard/page.tsx        # Modify: full dashboard
│   │   ├── evaluate/
│   │   │   ├── new/page.tsx          # Modify: input + persona selection flow
│   │   │   └── [id]/
│   │   │       ├── progress/page.tsx # Modify: realtime progress
│   │   │       └── result/page.tsx   # Modify: full results report
│   │   ├── pricing/page.tsx          # Modify: pricing cards
│   │   └── settings/page.tsx         # Modify: settings form
│   └── page.tsx                      # Modify: enhanced landing page
└── lib/
    └── supabase/
        └── realtime.ts               # Supabase realtime subscription helper
messages/
├── zh.json                           # Modify: add new translation keys
└── en.json                           # Modify: add new translation keys
```

---

### Task 1: Expand i18n Translation Keys

**Files:**
- Modify: `messages/zh.json`
- Modify: `messages/en.json`

All subsequent tasks depend on these keys existing.

- [ ] **Step 1: Update `messages/zh.json`**

Replace the entire file with:

```json
{
  "common": {
    "appName": "Persona",
    "tagline": "AI 虚拟焦点小组",
    "login": "登录",
    "register": "注册",
    "logout": "退出登录",
    "dashboard": "仪表盘",
    "newEvaluation": "新建评价",
    "pricing": "定价",
    "settings": "设置",
    "loading": "加载中...",
    "error": "出了点问题",
    "save": "保存",
    "cancel": "取消",
    "submit": "提交",
    "back": "返回",
    "viewResult": "查看报告",
    "startNew": "新建评价",
    "status": "状态",
    "createdAt": "创建时间",
    "score": "评分"
  },
  "landing": {
    "hero": "在花钱之前，先验证你的产品",
    "subtitle": "AI 人格模拟真实用户反馈，在投入营销之前就知道你的产品能否成功。",
    "cta": "免费开始",
    "featurePersonas": "多元人格视角",
    "featurePersonasDesc": "12+ AI 人格，涵盖技术、产品、设计、用户、商业五大类，从不同维度审视你的产品。",
    "featureReport": "深度诊断报告",
    "featureReportDesc": "不只是打分——一份可执行的产品诊断书，精准定位优劣势并给出改进方向。",
    "featureAction": "可执行行动清单",
    "featureActionDesc": "按优先级排列的具体改进项，每项带有预期影响和实施难度评估。"
  },
  "auth": {
    "loginTitle": "欢迎回来",
    "registerTitle": "创建账户",
    "email": "邮箱",
    "password": "密码",
    "loginWith": "使用 {provider} 登录",
    "noAccount": "还没有账户？",
    "hasAccount": "已有账户？"
  },
  "dashboard": {
    "title": "我的项目",
    "empty": "还没有评价记录，开始你的第一次评价吧！",
    "evaluationsUsed": "本月已使用 {used} / {limit} 次评价",
    "plan": "当前套餐：{plan}",
    "pending": "等待中",
    "processing": "评价中",
    "completed": "已完成",
    "failed": "失败"
  },
  "evaluation": {
    "inputPlaceholder": "描述你的项目、粘贴链接、或上传文件...",
    "startEvaluation": "开始评价",
    "selectPersonas": "选择评价人格",
    "recommended": "推荐",
    "inProgress": "评价进行中",
    "completed": "评价完成",
    "step1": "描述项目",
    "step2": "选择人格",
    "personaLimit": "最多可选 {max} 个人格（已选 {count} 个）",
    "aiRecommending": "AI 正在推荐最适合的人格...",
    "progressTitle": "AI 人格正在评价你的项目",
    "progressPersona": "{name} 评价中...",
    "progressDone": "{name} 评价完成",
    "generatingReport": "正在生成综合报告...",
    "viewFullReport": "查看完整报告",
    "overallScore": "综合评分",
    "marketReadiness": "市场就绪度",
    "personaAnalysis": "人格分析汇总",
    "consensus": "共识",
    "disagreements": "分歧",
    "dimensionAnalysis": "多维度产品解析",
    "goalAssessment": "目标达成评估",
    "achievable": "可达成",
    "notAchievable": "需改进",
    "ifNotFeasible": "修改方向",
    "ifFeasible": "优化路径",
    "actionItems": "可执行行动清单",
    "priority": "优先级",
    "impact": "预期影响",
    "difficulty": "难度",
    "scenarioSimulation": "真实场景模拟",
    "adoptionShift": "采纳率变化",
    "critical": "紧急",
    "high": "高",
    "medium": "中",
    "low": "低",
    "easy": "简单",
    "hard": "困难",
    "usability": "可用性",
    "market_fit": "市场契合度",
    "design": "设计质量",
    "tech_quality": "技术实现",
    "innovation": "创新性",
    "pricing": "商业模式",
    "strengths": "优势",
    "weaknesses": "不足",
    "modifications": "具体修改建议",
    "direction": "调整方向",
    "priorities": "优先级排序",
    "referenceCases": "参考案例",
    "nextSteps": "下一步行动",
    "optimizations": "优化建议",
    "risks": "潜在风险"
  },
  "pricing": {
    "title": "选择你的套餐",
    "free": "免费版",
    "pro": "Pro",
    "max": "Max",
    "perMonth": "/月",
    "evaluationsPerMonth": "每月 {count} 次评价",
    "personasPerEvaluation": "最多 {count} 个人格",
    "currentPlan": "当前套餐",
    "upgrade": "升级",
    "briefReport": "简要报告",
    "fullReport": "完整报告 + 行动清单",
    "fullReportPlus": "完整报告 + 行动清单 + 场景模拟",
    "mostPopular": "最受欢迎"
  },
  "settings": {
    "title": "设置",
    "language": "语言",
    "languageDesc": "选择界面语言",
    "profile": "个人信息",
    "email": "邮箱",
    "subscription": "订阅管理",
    "saved": "设置已保存"
  }
}
```

- [ ] **Step 2: Update `messages/en.json`**

Replace the entire file with:

```json
{
  "common": {
    "appName": "Persona",
    "tagline": "AI-Powered Virtual Focus Group",
    "login": "Log In",
    "register": "Sign Up",
    "logout": "Log Out",
    "dashboard": "Dashboard",
    "newEvaluation": "New Evaluation",
    "pricing": "Pricing",
    "settings": "Settings",
    "loading": "Loading...",
    "error": "Something went wrong",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "back": "Back",
    "viewResult": "View Report",
    "startNew": "New Evaluation",
    "status": "Status",
    "createdAt": "Created",
    "score": "Score"
  },
  "landing": {
    "hero": "Validate Your Product Before You Spend",
    "subtitle": "AI personas simulate real user feedback. Know if your product will succeed before investing in marketing.",
    "cta": "Get Started Free",
    "featurePersonas": "Diverse Persona Perspectives",
    "featurePersonasDesc": "12+ AI personas across technical, product, design, end-user, and business categories evaluate your product from every angle.",
    "featureReport": "Deep Diagnostic Report",
    "featureReportDesc": "Not just scores — an actionable product diagnosis that pinpoints strengths, weaknesses, and improvement paths.",
    "featureAction": "Executable Action Items",
    "featureActionDesc": "Prioritized improvement items, each with expected impact and implementation difficulty ratings."
  },
  "auth": {
    "loginTitle": "Welcome Back",
    "registerTitle": "Create Account",
    "email": "Email",
    "password": "Password",
    "loginWith": "Continue with {provider}",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?"
  },
  "dashboard": {
    "title": "My Projects",
    "empty": "No evaluations yet. Start your first one!",
    "evaluationsUsed": "{used} / {limit} evaluations used this month",
    "plan": "Current Plan: {plan}",
    "pending": "Pending",
    "processing": "Processing",
    "completed": "Completed",
    "failed": "Failed"
  },
  "evaluation": {
    "inputPlaceholder": "Describe your project, paste a link, or upload a file...",
    "startEvaluation": "Start Evaluation",
    "selectPersonas": "Select Evaluation Personas",
    "recommended": "Recommended",
    "inProgress": "Evaluation in progress",
    "completed": "Evaluation complete",
    "step1": "Describe Project",
    "step2": "Select Personas",
    "personaLimit": "Select up to {max} personas ({count} selected)",
    "aiRecommending": "AI is recommending the best personas...",
    "progressTitle": "AI personas are evaluating your project",
    "progressPersona": "{name} evaluating...",
    "progressDone": "{name} complete",
    "generatingReport": "Generating comprehensive report...",
    "viewFullReport": "View Full Report",
    "overallScore": "Overall Score",
    "marketReadiness": "Market Readiness",
    "personaAnalysis": "Persona Analysis Summary",
    "consensus": "Points of Consensus",
    "disagreements": "Points of Disagreement",
    "dimensionAnalysis": "Multi-Dimensional Analysis",
    "goalAssessment": "Goal Assessment",
    "achievable": "Achievable",
    "notAchievable": "Needs Work",
    "ifNotFeasible": "Modification Direction",
    "ifFeasible": "Optimization Path",
    "actionItems": "Action Items",
    "priority": "Priority",
    "impact": "Expected Impact",
    "difficulty": "Difficulty",
    "scenarioSimulation": "Real-World Scenario Simulation",
    "adoptionShift": "Adoption Rate Shift",
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "easy": "Easy",
    "hard": "Hard",
    "usability": "Usability",
    "market_fit": "Market Fit",
    "design": "Design Quality",
    "tech_quality": "Technical Quality",
    "innovation": "Innovation",
    "pricing": "Business Model",
    "strengths": "Strengths",
    "weaknesses": "Weaknesses",
    "modifications": "Specific Modifications",
    "direction": "Pivot Direction",
    "priorities": "Priority Ordering",
    "referenceCases": "Reference Cases",
    "nextSteps": "Next Steps",
    "optimizations": "Optimizations",
    "risks": "Risks to Watch"
  },
  "pricing": {
    "title": "Choose Your Plan",
    "free": "Free",
    "pro": "Pro",
    "max": "Max",
    "perMonth": "/month",
    "evaluationsPerMonth": "{count} evaluations/month",
    "personasPerEvaluation": "Up to {count} personas",
    "currentPlan": "Current Plan",
    "upgrade": "Upgrade",
    "briefReport": "Brief report",
    "fullReport": "Full report + Action items",
    "fullReportPlus": "Full report + Action items + Scenario sim",
    "mostPopular": "Most Popular"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "languageDesc": "Choose interface language",
    "profile": "Profile",
    "email": "Email",
    "subscription": "Subscription",
    "saved": "Settings saved"
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

Expected: Build succeeds (existing pages still reference valid keys).

- [ ] **Step 4: Commit**

```bash
git add messages/zh.json messages/en.json
git commit -m "feat: expand i18n translation keys for all frontend pages"
```

---

### Task 2: Dashboard Page

**Files:**
- Create: `src/components/dashboard/usage-bar.tsx`
- Create: `src/components/dashboard/project-card.tsx`
- Create: `src/components/dashboard/project-list.tsx`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`

**Context:**
- The API `GET /api/evaluations` returns `{ projects: [...] }` where each project has nested `evaluations` array.
- The `GET /api/evaluations` route is at `src/app/api/evaluations/route.ts` — it queries projects with nested evaluations for the current user.
- The subscription table has `evaluations_used`, `evaluations_limit`, `plan`.
- Supabase server client is at `src/lib/supabase/server.ts` — it's an async function: `const supabase = await createClient()`.
- All server pages use `getTranslations` from `next-intl/server` for i18n.
- For locale-aware links, use `useLocale()` from `next-intl` (in server components, use the locale from layout params or `useLocale()`).

- [ ] **Step 1: Create `src/components/dashboard/usage-bar.tsx`**

```tsx
import { getTranslations } from "next-intl/server";

interface UsageBarProps {
  used: number;
  limit: number;
  plan: string;
}

export async function UsageBar({ used, limit, plan }: UsageBarProps) {
  const t = await getTranslations("dashboard");
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t("evaluationsUsed", { used, limit })}
        </span>
        <span className="font-medium">{t("plan", { plan: plan.toUpperCase() })}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/dashboard/project-card.tsx`**

```tsx
import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Evaluation {
  id: string;
  status: string;
  selected_persona_ids: string[];
  created_at: string;
  completed_at: string | null;
}

interface ProjectCardProps {
  project: {
    id: string;
    raw_input: string;
    parsed_data: { name?: string; description?: string } | null;
    created_at: string;
    evaluations: Evaluation[];
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export async function ProjectCard({ project }: ProjectCardProps) {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = useLocale();
  const latestEval = project.evaluations[0];
  const title = project.parsed_data?.name || project.raw_input.slice(0, 60) + (project.raw_input.length > 60 ? "..." : "");
  const description = project.parsed_data?.description || project.raw_input.slice(0, 120);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">{title}</CardTitle>
          {latestEval && (
            <Badge variant="secondary" className={statusColors[latestEval.status] || ""}>
              {t(latestEval.status as "pending" | "processing" | "completed" | "failed")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(project.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
          </span>
          {latestEval && (
            <Button size="sm" variant="outline" asChild>
              <Link
                href={
                  latestEval.status === "completed"
                    ? `/${locale}/evaluate/${latestEval.id}/result`
                    : latestEval.status === "processing" || latestEval.status === "pending"
                    ? `/${locale}/evaluate/${latestEval.id}/progress`
                    : "#"
                }
              >
                {latestEval.status === "completed" ? tc("viewResult") : t(latestEval.status as "pending" | "processing")}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `src/components/dashboard/project-list.tsx`**

```tsx
import { ProjectCard } from "./project-card";

interface ProjectListProps {
  projects: Array<{
    id: string;
    raw_input: string;
    parsed_data: { name?: string; description?: string } | null;
    created_at: string;
    evaluations: Array<{
      id: string;
      status: string;
      selected_persona_ids: string[];
      created_at: string;
      completed_at: string | null;
    }>;
  }>;
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Update `src/app/[locale]/(app)/dashboard/page.tsx`**

Replace the entire file with:

```tsx
import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { UsageBar } from "@/components/dashboard/usage-bar";
import { ProjectList } from "@/components/dashboard/project-list";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = useLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: projects }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).single(),
    supabase
      .from("projects")
      .select("id, raw_input, parsed_data, url, created_at, evaluations (id, status, selected_persona_ids, created_at, completed_at)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href={`/${locale}/evaluate/new`}>{tc("startNew")}</Link>
        </Button>
      </div>

      {subscription && (
        <UsageBar
          used={subscription.evaluations_used}
          limit={subscription.evaluations_limit}
          plan={subscription.plan}
        />
      )}

      {projects && projects.length > 0 ? (
        <ProjectList projects={projects as any} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="mb-4 text-muted-foreground">{t("empty")}</p>
          <Button asChild>
            <Link href={`/${locale}/evaluate/new`}>{tc("startNew")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/ src/app/\\[locale\\]/\\(app\\)/dashboard/page.tsx
git commit -m "feat: build dashboard page with project list and usage bar"
```

---

### Task 3: New Evaluation Page — Project Input Component

**Files:**
- Create: `src/components/evaluation/project-input.tsx`

**Context:**
- This is a ChatGPT-style input box: rounded, minimal, clean.
- Supports: plain text, URL auto-detection, file attachments (PDF, images).
- Single input — NOT multi-turn conversation.
- At bottom: attachment icons (left), submit button (right).
- The component calls `onChange` with the text and `onSubmit` to proceed to persona selection.

- [ ] **Step 1: Install Shadcn textarea component**

Run:
```bash
cd /Users/pinan/Desktop/persona && npx shadcn@latest add textarea -y
```

- [ ] **Step 2: Create `src/components/evaluation/project-input.tsx`**

```tsx
"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, FileText, Image, ArrowUp, X } from "lucide-react";

interface ProjectInputProps {
  onSubmit: (data: { rawInput: string; url: string | null; files: File[] }) => void;
  disabled?: boolean;
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function ProjectInput({ onSubmit, disabled }: ProjectInputProps) {
  const t = useTranslations("evaluation");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!text.trim() && files.length === 0) return;
    onSubmit({
      rawInput: text.trim(),
      url: extractUrl(text),
      files,
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          disabled={disabled}
        />

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-xs"
              >
                {file.type.startsWith("image/") ? (
                  <Image className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <div className="flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <Button
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && files.length === 0)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/evaluation/project-input.tsx src/components/ui/textarea.tsx
git commit -m "feat: add ChatGPT-style project input component"
```

---

### Task 4: New Evaluation Page — Persona Selector Component

**Files:**
- Create: `src/components/evaluation/persona-selector.tsx`

**Context:**
- Fetches personas from `GET /api/personas` — returns `{ personas: [...] }` with fields: `id, identity, demographics, evaluation_lens, category`.
- Calls `POST /api/personas/recommend` with `{ projectDescription }` — returns `{ recommended_ids: [...], reasoning: string }`.
- Shows personas in a grid, grouped by category (technical, product, design, end_user, business).
- Recommended ones get a badge.
- Persona max limit is passed in as prop (3 for free, 10 for pro, 20 for max).
- Persona identity has `locale_variants.zh` and `locale_variants.en` for localized name/tagline.

- [ ] **Step 1: Create `src/components/evaluation/persona-selector.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

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
  demographics: { occupation: string };
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

export function PersonaSelector({ projectDescription, maxPersonas, onConfirm, disabled }: PersonaSelectorProps) {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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
      // Auto-select recommended, up to max
      const autoSelect = (recommended_ids || []).slice(0, maxPersonas);
      setSelectedIds(new Set(autoSelect));
      setLoading(false);
    }
    load();
  }, [projectDescription, maxPersonas]);

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

  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    label: categoryLabels[cat]?.[locale] || cat,
    personas: personas.filter((p) => p.category === cat),
  })).filter((g) => g.personas.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Sparkles className="mb-3 h-6 w-6 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">{t("aiRecommending")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("personaLimit", { max: maxPersonas, count: selectedIds.size })}
        </p>
        <Button onClick={() => onConfirm(Array.from(selectedIds))} disabled={disabled || selectedIds.size === 0}>
          {t("startEvaluation")}
        </Button>
      </div>

      {grouped.map((group) => (
        <div key={group.category}>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {group.label}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.personas.map((persona) => {
              const isSelected = selectedIds.has(persona.id);
              const isRecommended = recommendedIds.has(persona.id);
              const localized = persona.identity.locale_variants[locale as "zh" | "en"] || persona.identity.locale_variants.en;

              return (
                <Card
                  key={persona.id}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-foreground/20"
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
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/evaluation/persona-selector.tsx
git commit -m "feat: add persona selector with AI recommendations and category grouping"
```

---

### Task 5: New Evaluation Page — Assemble Page

**Files:**
- Modify: `src/app/[locale]/(app)/evaluate/new/page.tsx`

**Context:**
- This page has a 2-step flow: Step 1 = project input, Step 2 = persona selection.
- After persona selection, calls `POST /api/evaluations` with `{ rawInput, url, selectedPersonaIds }`.
- On success, redirects to `/${locale}/evaluate/${evaluationId}/progress`.
- Subscription data needed for persona limits: free=3, pro=10, max=20.
- This is a Client Component because of the multi-step interactive flow.

- [ ] **Step 1: Update `src/app/[locale]/(app)/evaluate/new/page.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectInput } from "@/components/evaluation/project-input";
import { PersonaSelector } from "@/components/evaluation/persona-selector";

const personaLimits: Record<string, number> = { free: 3, pro: 10, max: 20 };

export default function NewEvaluationPage() {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [projectData, setProjectData] = useState<{
    rawInput: string;
    url: string | null;
    files: File[];
  } | null>(null);
  const [maxPersonas, setMaxPersonas] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleProjectSubmit(data: { rawInput: string; url: string | null; files: File[] }) {
    setProjectData(data);
    // Fetch subscription to know persona limit
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", user.id).single();
      if (sub) {
        setMaxPersonas(personaLimits[sub.plan] || 3);
      }
    }
    setStep(2);
  }

  async function handleConfirm(selectedPersonaIds: string[]) {
    if (!projectData) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: projectData.rawInput,
          url: projectData.url,
          selectedPersonaIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create evaluation");
      }

      const { evaluation } = await res.json();
      router.push(`/${locale}/evaluate/${evaluation.id}/progress`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === 1 ? "text-foreground" : "text-muted-foreground"}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span className="text-sm font-medium">{t("step1")}</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-2 ${step === 2 ? "text-foreground" : "text-muted-foreground"}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span className="text-sm font-medium">{t("step2")}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold">{t("step1")}</h1>
          <ProjectInput onSubmit={handleProjectSubmit} />
        </>
      )}

      {step === 2 && projectData && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{t("selectPersonas")}</h1>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("step1")}
            </button>
          </div>
          <PersonaSelector
            projectDescription={projectData.rawInput}
            maxPersonas={maxPersonas}
            onConfirm={handleConfirm}
            disabled={submitting}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\\[locale\\]/\\(app\\)/evaluate/new/page.tsx
git commit -m "feat: build new evaluation page with 2-step input and persona selection flow"
```

---

### Task 6: Evaluation Progress Page (Realtime)

**Files:**
- Create: `src/lib/supabase/realtime.ts`
- Create: `src/components/evaluation/progress-tracker.tsx`
- Modify: `src/app/[locale]/(app)/evaluate/[id]/progress/page.tsx`

**Context:**
- Supabase Realtime is enabled for `evaluations` and `persona_reviews` tables (see the migration).
- The progress page subscribes to changes on `evaluations` (status change) and `persona_reviews` (new inserts) for the given evaluation ID.
- When evaluation status becomes "completed", redirect to the result page.
- Need to know which personas were selected to show pending vs. completed progress. The evaluation has `selected_persona_ids[]`. Persona names come from the personas table.
- The browser supabase client is at `src/lib/supabase/client.ts`.

- [ ] **Step 1: Create `src/lib/supabase/realtime.ts`**

```tsx
import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function subscribeToEvaluation(
  evaluationId: string,
  callbacks: {
    onStatusChange: (status: string) => void;
    onNewReview: (review: { persona_id: string }) => void;
  }
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`evaluation-${evaluationId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "evaluations",
        filter: `id=eq.${evaluationId}`,
      },
      (payload) => {
        callbacks.onStatusChange(payload.new.status);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "persona_reviews",
        filter: `evaluation_id=eq.${evaluationId}`,
      },
      (payload) => {
        callbacks.onNewReview({ persona_id: payload.new.persona_id });
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  const supabase = createClient();
  supabase.removeChannel(channel);
}
```

- [ ] **Step 2: Create `src/components/evaluation/progress-tracker.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, FileText } from "lucide-react";
import { subscribeToEvaluation, unsubscribe } from "@/lib/supabase/realtime";

interface PersonaInfo {
  id: string;
  name: string;
  avatar: string;
}

interface ProgressTrackerProps {
  evaluationId: string;
  personas: PersonaInfo[];
  initialCompletedIds: string[];
  initialStatus: string;
}

export function ProgressTracker({
  evaluationId,
  personas,
  initialCompletedIds,
  initialStatus,
}: ProgressTrackerProps) {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompletedIds));
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status === "completed") {
      const timer = setTimeout(() => {
        router.push(`/${locale}/evaluate/${evaluationId}/result`);
      }, 1500);
      return () => clearTimeout(timer);
    }

    const channel = subscribeToEvaluation(evaluationId, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onNewReview: (review) => {
        setCompletedIds((prev) => new Set([...prev, review.persona_id]));
      },
    });

    return () => {
      unsubscribe(channel);
    };
  }, [evaluationId, locale, router, status]);

  const allReviewsDone = completedIds.size >= personas.length;
  const progress = personas.length > 0 ? (completedIds.size / personas.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("progressTitle")}</h1>
        <div className="mt-4 h-2 rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {completedIds.size} / {personas.length}
        </p>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {personas.map((persona) => {
            const isDone = completedIds.has(persona.id);
            return (
              <motion.div
                key={persona.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isDone ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "bg-card"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-base">
                  {persona.avatar}
                </div>
                <span className="flex-1 text-sm font-medium">{persona.name}</span>
                {isDone ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {allReviewsDone && status !== "completed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <FileText className="h-4 w-4 animate-pulse" />
          {t("generatingReport")}
        </motion.div>
      )}

      {status === "completed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-sm text-green-600"
        >
          {t("completed")}
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `src/app/[locale]/(app)/evaluate/[id]/progress/page.tsx`**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/server";
import { ProgressTracker } from "@/components/evaluation/progress-tracker";

export default async function EvaluationProgressPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);

  // Fetch evaluation with its existing reviews
  const { data: evaluation } = await supabase
    .from("evaluations")
    .select(`id, status, selected_persona_ids, persona_reviews (persona_id)`)
    .eq("id", id)
    .single();

  if (!evaluation) redirect(`/${locale}/dashboard`);

  // If already completed, redirect to result
  if (evaluation.status === "completed") {
    redirect(`/${locale}/evaluate/${id}/result`);
  }

  // Fetch persona info for display
  const { data: personas } = await supabase
    .from("personas")
    .select("id, identity")
    .in("id", evaluation.selected_persona_ids);

  const personaInfos = (personas || []).map((p: any) => ({
    id: p.id,
    name: p.identity.locale_variants?.[locale]?.name || p.identity.name,
    avatar: p.identity.avatar,
  }));

  const completedIds = ((evaluation as any).persona_reviews || []).map((r: any) => r.persona_id);

  return (
    <ProgressTracker
      evaluationId={id}
      personas={personaInfos}
      initialCompletedIds={completedIds}
      initialStatus={evaluation.status}
    />
  );
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/realtime.ts src/components/evaluation/progress-tracker.tsx src/app/\\[locale\\]/\\(app\\)/evaluate/\\[id\\]/progress/page.tsx
git commit -m "feat: add realtime evaluation progress page with Supabase subscriptions"
```

---

### Task 7: Score Radar Chart Component

**Files:**
- Create: `src/components/evaluation/score-radar.tsx`

**Context:**
- Displays the 6 evaluation dimensions as a horizontal bar chart (simpler and more readable than a radar chart at small sizes).
- Dimensions: usability, market_fit, design, tech_quality, innovation, pricing. Each scored 1-10.
- Used in persona review cards and the report dimension analysis.

- [ ] **Step 1: Create `src/components/evaluation/score-radar.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

interface ScoreBarProps {
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  compact?: boolean;
}

const dimensions = ["usability", "market_fit", "design", "tech_quality", "innovation", "pricing"] as const;

function scoreColor(score: number): string {
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-blue-500";
  if (score >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

export function ScoreBar({ scores, compact }: ScoreBarProps) {
  const t = useTranslations("evaluation");

  return (
    <div className={`space-y-${compact ? "1.5" : "2"}`}>
      {dimensions.map((dim) => {
        const score = scores[dim];
        return (
          <div key={dim} className="flex items-center gap-2">
            <span className={`${compact ? "w-16 text-[11px]" : "w-24 text-xs"} text-muted-foreground truncate`}>
              {t(dim)}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <motion.div
                className={`h-full rounded-full ${scoreColor(score)}`}
                initial={{ width: 0 }}
                animate={{ width: `${score * 10}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
              />
            </div>
            <span className={`${compact ? "w-5 text-[11px]" : "w-6 text-xs"} text-right font-medium`}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/evaluation/score-radar.tsx
git commit -m "feat: add score bar chart component for evaluation dimensions"
```

---

### Task 8: Persona Review Card Component

**Files:**
- Create: `src/components/evaluation/persona-review-card.tsx`

**Context:**
- Displays a single persona's review: avatar, name, scores (bar chart), review text, strengths, weaknesses.
- Persona name needs locale-aware lookup. Since we'll have the persona identity data alongside the review, we pass it in.
- Uses the `ScoreBar` component from Task 7.

- [ ] **Step 1: Create `src/components/evaluation/persona-review-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./score-radar";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PersonaReviewCardProps {
  personaName: string;
  personaAvatar: string;
  personaOccupation: string;
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  reviewText: string;
  strengths: string[];
  weaknesses: string[];
}

export function PersonaReviewCard({
  personaName,
  personaAvatar,
  personaOccupation,
  scores,
  reviewText,
  strengths,
  weaknesses,
}: PersonaReviewCardProps) {
  const t = useTranslations("evaluation");
  const [expanded, setExpanded] = useState(false);
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 6;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
            {personaAvatar}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{personaName}</span>
              <Badge variant="secondary" className="text-xs">
                {avgScore.toFixed(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{personaOccupation}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreBar scores={scores} compact />

        {expanded && (
          <div className="space-y-4 pt-2">
            <p className="text-sm leading-relaxed text-foreground/90">{reviewText}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-green-600">{t("strengths")}</h4>
                <ul className="space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground">+ {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-red-600">{t("weaknesses")}</h4>
                <ul className="space-y-1">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground">- {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/evaluation/persona-review-card.tsx
git commit -m "feat: add persona review card with expandable details"
```

---

### Task 9: Report Section Component

**Files:**
- Create: `src/components/evaluation/report-section.tsx`

**Context:**
- A simple styled wrapper for each section of the report (persona analysis, dimension analysis, goal assessment, etc.).
- Takes a title, icon color, and children.

- [ ] **Step 1: Create `src/components/evaluation/report-section.tsx`**

```tsx
interface ReportSectionProps {
  title: string;
  borderColor?: string;
  children: React.ReactNode;
}

export function ReportSection({ title, borderColor = "border-l-primary", children }: ReportSectionProps) {
  return (
    <section className={`rounded-lg border bg-card p-6 border-l-4 ${borderColor}`}>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/evaluation/report-section.tsx
git commit -m "feat: add report section wrapper component"
```

---

### Task 10: Evaluation Result Page

**Files:**
- Modify: `src/app/[locale]/(app)/evaluate/[id]/result/page.tsx`

**Context:**
- This is the main results page — a long-form report showing:
  1. Overall score + market readiness badge
  2. Individual persona review cards (collapsible)
  3. Persona analysis summary (consensus + disagreements)
  4. Multi-dimensional analysis (6 dimensions with strengths/weaknesses)
  5. Goal assessment (achievable/not-achievable per goal)
  6. If not feasible: modification direction
  7. If feasible: optimization path
  8. Action items (priority-sorted table)
  9. Scenario simulation (if Max plan)
- Data comes from `GET /api/evaluations/[id]` which returns evaluation + persona_reviews + summary_reports.
- Persona identity info (name, avatar) needs to be fetched separately since reviews only have persona_id.
- This is a Server Component that renders Client Components (ScoreBar, PersonaReviewCard).

- [ ] **Step 1: Update `src/app/[locale]/(app)/evaluate/[id]/result/page.tsx`**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PersonaReviewCard } from "@/components/evaluation/persona-review-card";
import { ScoreBar } from "@/components/evaluation/score-radar";
import { ReportSection } from "@/components/evaluation/report-section";

const readinessColors: Record<string, string> = {
  low: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations("evaluation");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);

  // Fetch evaluation with all nested data
  const { data: evaluation } = await supabase
    .from("evaluations")
    .select(`id, status, selected_persona_ids, created_at, completed_at,
      persona_reviews (id, persona_id, scores, review_text, strengths, weaknesses, llm_model, created_at),
      summary_reports (*)`)
    .eq("id", id)
    .single();

  if (!evaluation || evaluation.status !== "completed") {
    redirect(`/${locale}/dashboard`);
  }

  // Fetch persona info for display names
  const { data: personas } = await supabase
    .from("personas")
    .select("id, identity, demographics, category")
    .in("id", evaluation.selected_persona_ids);

  const personaMap = new Map(
    (personas || []).map((p: any) => [p.id, p])
  );

  const reviews = (evaluation as any).persona_reviews || [];
  const report = ((evaluation as any).summary_reports || [])[0];

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header: Overall Score + Market Readiness */}
      {report && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="text-5xl font-bold">{report.overall_score}</div>
          <p className="text-sm text-muted-foreground">{t("overallScore")}</p>
          <Badge className={readinessColors[report.market_readiness] || ""}>
            {t("marketReadiness")}: {t(report.market_readiness as "low" | "medium" | "high")}
          </Badge>
        </div>
      )}

      {/* Individual Persona Reviews */}
      <div>
        <h2 className="mb-4 text-xl font-bold">{t("personaAnalysis")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((review: any) => {
            const persona = personaMap.get(review.persona_id) as any;
            const localized = persona?.identity?.locale_variants?.[locale] || persona?.identity;
            return (
              <PersonaReviewCard
                key={review.id}
                personaName={localized?.name || "Unknown"}
                personaAvatar={persona?.identity?.avatar || "?"}
                personaOccupation={persona?.demographics?.occupation || ""}
                scores={review.scores}
                reviewText={review.review_text}
                strengths={review.strengths}
                weaknesses={review.weaknesses}
              />
            );
          })}
        </div>
      </div>

      {report && (
        <>
          {/* Consensus & Disagreements */}
          <ReportSection title={t("consensus")} borderColor="border-l-violet-500">
            <ul className="space-y-2">
              {report.persona_analysis?.consensus?.map((c: any, i: number) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{c.point}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({c.supporting_personas?.join(", ")})
                  </span>
                </li>
              ))}
            </ul>
          </ReportSection>

          {report.persona_analysis?.disagreements?.length > 0 && (
            <ReportSection title={t("disagreements")} borderColor="border-l-orange-500">
              <div className="space-y-3">
                {report.persona_analysis.disagreements.map((d: any, i: number) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{d.point}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{d.reason}</p>
                  </div>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Multi-Dimensional Analysis */}
          <ReportSection title={t("dimensionAnalysis")} borderColor="border-l-blue-500">
            <div className="space-y-6">
              {report.multi_dimensional_analysis?.map((dim: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t(dim.dimension)}</h3>
                    <span className="text-sm font-bold">{dim.score}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{dim.analysis}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-medium text-green-600">{t("strengths")}:</span>
                      <ul className="mt-1 space-y-0.5">
                        {dim.strengths?.map((s: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground">+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-red-600">{t("weaknesses")}:</span>
                      <ul className="mt-1 space-y-0.5">
                        {dim.weaknesses?.map((w: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground">- {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Goal Assessment */}
          <ReportSection title={t("goalAssessment")} borderColor="border-l-yellow-500">
            <div className="space-y-3">
              {report.goal_assessment?.map((goal: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <Badge variant="secondary" className={goal.achievable ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                    {goal.achievable ? t("achievable") : t("notAchievable")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{goal.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{goal.current_status}</p>
                    {goal.gaps?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {goal.gaps.map((g: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground">- {g}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* If Not Feasible */}
          <ReportSection title={t("ifNotFeasible")} borderColor="border-l-red-500">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{t("direction")}</h4>
                <p className="text-sm text-muted-foreground">{report.if_not_feasible?.direction}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold">{t("modifications")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_not_feasible?.modifications?.map((m: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">- {m}</li>
                  ))}
                </ul>
              </div>
              {report.if_not_feasible?.reference_cases?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold">{t("referenceCases")}</h4>
                  <ul className="mt-1 space-y-1">
                    {report.if_not_feasible.reference_cases.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ReportSection>

          {/* If Feasible */}
          <ReportSection title={t("ifFeasible")} borderColor="border-l-green-500">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{t("nextSteps")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_feasible?.next_steps?.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">- {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold">{t("risks")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_feasible?.risks?.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">- {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ReportSection>

          {/* Action Items */}
          <ReportSection title={t("actionItems")} borderColor="border-l-cyan-500">
            <div className="space-y-2">
              {report.action_items?.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <Badge variant="secondary" className={priorityColors[item.priority] || ""}>
                    {t(item.priority as "critical" | "high" | "medium" | "low")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>{t("impact")}: {item.expected_impact}</span>
                      <span>{t("difficulty")}: {t(item.difficulty as "easy" | "medium" | "hard")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Scenario Simulation (Max plan only) */}
          {report.scenario_simulation && (
            <ReportSection title={t("scenarioSimulation")} borderColor="border-l-purple-500">
              <div className="space-y-4">
                <p className="text-sm">{report.scenario_simulation.summary}</p>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-sm font-medium">{t("adoptionShift")}:</span>
                  <span className={`text-lg font-bold ${report.scenario_simulation.adoption_rate_shift >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {report.scenario_simulation.adoption_rate_shift >= 0 ? "+" : ""}{report.scenario_simulation.adoption_rate_shift}%
                  </span>
                </div>
                {report.scenario_simulation.influence_events?.length > 0 && (
                  <div className="space-y-2">
                    {report.scenario_simulation.influence_events.map((event: any, i: number) => {
                      const influencer = personaMap.get(event.influencer_id) as any;
                      const influenced = personaMap.get(event.influenced_id) as any;
                      const getName = (p: any) => p?.identity?.locale_variants?.[locale]?.name || p?.identity?.name || "?";
                      return (
                        <div key={i} className="rounded bg-muted/30 p-2 text-xs">
                          <span className="font-medium">{getName(influencer)}</span>
                          {" → "}
                          <span className="font-medium">{getName(influenced)}</span>
                          : {event.shift}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ReportSection>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\\[locale\\]/\\(app\\)/evaluate/\\[id\\]/result/page.tsx
git commit -m "feat: build full evaluation result page with report sections"
```

---

### Task 11: Pricing Page

**Files:**
- Create: `src/components/pricing/plan-card.tsx`
- Modify: `src/app/[locale]/(app)/pricing/page.tsx`

**Context:**
- Three plans: Free ($0, 1 eval/mo, 3 personas, brief report), Pro ($20/mo, 10 evals, 10 personas, full report + actions), Max ($100/mo, 40 evals, 20 personas, full report + actions + scenario sim).
- For now, the upgrade button is a placeholder (Stripe integration is Plan 4).
- Shows "Current Plan" badge for the user's active plan.
- This page is accessible to both logged-in and logged-out users (it's in the (app) group but pricing should work for guests too — the header handles the auth state display).

- [ ] **Step 1: Create `src/components/pricing/plan-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PlanCardProps {
  name: string;
  price: string;
  perMonth: string;
  features: string[];
  isCurrent: boolean;
  isPopular?: boolean;
  currentPlanLabel: string;
  upgradeLabel: string;
  popularLabel: string;
}

export function PlanCard({
  name,
  price,
  perMonth,
  features,
  isCurrent,
  isPopular,
  currentPlanLabel,
  upgradeLabel,
  popularLabel,
}: PlanCardProps) {
  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-md" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          {popularLabel}
        </Badge>
      )}
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-4xl font-bold">{price}</span>
          {price !== "$0" && <span className="text-muted-foreground">{perMonth}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
        <Button className="w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent}>
          {isCurrent ? currentPlanLabel : upgradeLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update `src/app/[locale]/(app)/pricing/page.tsx`**

Replace the entire file with:

```tsx
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PlanCard } from "@/components/pricing/plan-card";

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = "free";
  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single();
    if (sub) currentPlan = sub.plan;
  }

  const plans = [
    {
      key: "free",
      name: t("free"),
      price: "$0",
      features: [
        t("evaluationsPerMonth", { count: 1 }),
        t("personasPerEvaluation", { count: 3 }),
        t("briefReport"),
      ],
    },
    {
      key: "pro",
      name: t("pro"),
      price: "$20",
      isPopular: true,
      features: [
        t("evaluationsPerMonth", { count: 10 }),
        t("personasPerEvaluation", { count: 10 }),
        t("fullReport"),
      ],
    },
    {
      key: "max",
      name: t("max"),
      price: "$100",
      features: [
        t("evaluationsPerMonth", { count: 40 }),
        t("personasPerEvaluation", { count: 20 }),
        t("fullReportPlus"),
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">{t("title")}</h1>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            name={plan.name}
            price={plan.price}
            perMonth={t("perMonth")}
            features={plan.features}
            isCurrent={currentPlan === plan.key}
            isPopular={plan.isPopular}
            currentPlanLabel={t("currentPlan")}
            upgradeLabel={t("upgrade")}
            popularLabel={t("mostPopular")}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/pricing/plan-card.tsx src/app/\\[locale\\]/\\(app\\)/pricing/page.tsx
git commit -m "feat: build pricing page with three plan cards"
```

---

### Task 12: Settings Page

**Files:**
- Create: `src/components/settings/profile-form.tsx`
- Modify: `src/app/[locale]/(app)/settings/page.tsx`

**Context:**
- Settings page shows: email (read-only), language toggle, subscription info.
- Language toggle changes the locale in the URL using next-intl routing.
- The locale switcher already exists at `src/components/layout/locale-switcher.tsx` — reuse the same mechanism.

- [ ] **Step 1: Create `src/components/settings/profile-form.tsx`**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProfileFormProps {
  email: string;
  plan: string;
  evaluationsUsed: number;
  evaluationsLimit: number;
}

export function ProfileForm({ email, plan, evaluationsUsed, evaluationsLimit }: ProfileFormProps) {
  const t = useTranslations("settings");
  const td = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input value={email} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{t("languageDesc")}</p>
          <div className="flex gap-2">
            <Button
              variant={locale === "zh" ? "default" : "outline"}
              size="sm"
              onClick={() => switchLocale("zh")}
            >
              中文
            </Button>
            <Button
              variant={locale === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => switchLocale("en")}
            >
              English
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("subscription")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{td("plan", { plan: plan.toUpperCase() })}</p>
          <p className="text-sm text-muted-foreground">
            {td("evaluationsUsed", { used: evaluationsUsed, limit: evaluationsLimit })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/[locale]/(app)/settings/page.tsx`**

Replace the entire file with:

```tsx
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, evaluations_used, evaluations_limit")
    .eq("user_id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <ProfileForm
        email={user!.email ?? ""}
        plan={subscription?.plan ?? "free"}
        evaluationsUsed={subscription?.evaluations_used ?? 0}
        evaluationsLimit={subscription?.evaluations_limit ?? 1}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/profile-form.tsx src/app/\\[locale\\]/\\(app\\)/settings/page.tsx
git commit -m "feat: build settings page with profile, language, and subscription info"
```

---

### Task 13: Enhanced Landing Page

**Files:**
- Modify: `src/app/[locale]/page.tsx`

**Context:**
- The current landing page is bare: just hero text + CTA. Enhance it with feature highlight cards using the new translation keys (featurePersonas, featureReport, featureAction).
- Keep it clean and minimal. Uses Framer Motion for subtle entrance animations.
- Fix the unused `tc` variable.

- [ ] **Step 1: Update `src/app/[locale]/page.tsx`**

Replace the entire file with:

```tsx
import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Users, FileBarChart, ListChecks } from "lucide-react";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = useLocale();

  const features = [
    { icon: Users, title: t("featurePersonas"), desc: t("featurePersonasDesc") },
    { icon: FileBarChart, title: t("featureReport"), desc: t("featureReportDesc") },
    { icon: ListChecks, title: t("featureAction"), desc: t("featureActionDesc") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {t("hero")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
          <Button size="lg" asChild>
            <Link href={`/${locale}/auth/register`}>{t("cta")}</Link>
          </Button>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 px-4 py-16">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\\[locale\\]/page.tsx
git commit -m "feat: enhance landing page with feature highlights"
```

---

### Task 14: Final Verification + Build Check

**Files:**
- None new

- [ ] **Step 1: Run full build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Verify all routes render**

Check that the build output lists all expected routes:
- `/_not-found`
- `/[locale]` (landing)
- `/[locale]/auth/callback`
- `/[locale]/auth/login`
- `/[locale]/auth/register`
- `/[locale]/dashboard`
- `/[locale]/evaluate/[id]/progress`
- `/[locale]/evaluate/[id]/result`
- `/[locale]/evaluate/new`
- `/[locale]/pricing`
- `/[locale]/settings`
- `/api/evaluations`
- `/api/evaluations/[id]`
- `/api/health`
- `/api/personas`
- `/api/personas/recommend`

- [ ] **Step 3: Final commit (if any fixes were needed)**

```bash
cd /Users/pinan/Desktop/persona
git add -A
git commit -m "fix: resolve build issues — Plan 3 complete"
```

---

## Summary

Plan 3 delivers:
- **Dashboard** — project list with evaluation status cards, subscription usage bar
- **New Evaluation** — ChatGPT-style input box (text, URL auto-detect, file uploads) → persona selector with AI recommendations and category grouping → API submission
- **Evaluation Progress** — Supabase Realtime progress tracking with animated persona completion list, auto-redirect on completion
- **Evaluation Results** — Full report page: overall score, persona review cards (expandable), consensus/disagreements, 6-dimension analysis, goal assessment, modification direction, optimization path, action items, scenario simulation
- **Pricing** — Three-tier pricing cards with current plan indicator
- **Settings** — Profile info, language toggle, subscription info
- **Landing Page** — Enhanced with feature highlights
- **i18n** — Complete zh/en translation keys for all pages
