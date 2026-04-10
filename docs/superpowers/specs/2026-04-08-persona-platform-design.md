# Hygge (原 Persona) — AI 多视角讨论平台

> **最后更新**: 2026-04-09
> **线上地址**: https://persona-ivory-three.vercel.app/

## Overview

使用 AI 人格从多角度讨论用户提出的任何话题（产品、想法、政策、设计等），为用户提供多元化的深度洞察和行动建议。

**目标用户:** 独立开发者（主要）、小型创业团队（次要）
**语言:** 中文 + 英文 (V1)

---

## 实现状态总览

| 模块 | 状态 | 备注 |
|------|------|------|
| 项目基础设施 | ✅ 已完成 | Next.js 16 + Supabase + next-intl |
| 用户认证 | ✅ 已完成 | Supabase Auth (Email + OAuth) |
| 数据库 Schema | ✅ 已完成 | 2 个 migration 文件 |
| AI Worker | ✅ 已完成 | BullMQ + Redis + Claude SDK |
| Persona 系统 | ✅ 已完成 | 101 个 persona，11 层模型 |
| Landing Page | ✅ 已完成 | Hero + Features + How it Works + Persona Showcase + CTA |
| Dashboard | ✅ 已完成 | 项目列表 + 用量统计 + 删除功能 |
| 新建讨论流程 | ✅ 已完成 | 输入框 + 文件上传 + Persona 选择 + AI 推荐 |
| 讨论进度页 | ✅ 已完成 | 实时轮询 + 3 步指示器 + 动画状态消息 |
| 报告页 | ✅ 已完成 | 文字报告(默认) + 数值评分(子视图) |
| 定价页 | ✅ 已完成 | Apple 风格对比布局 + Stripe Checkout |
| 设置页 | ✅ 已完成 | 语言切换 + 个人资料 |
| Stripe 支付 | ✅ 已完成 | Checkout + Portal + Webhook |
| i18n | ✅ 已完成 | 中/英双语 |
| 部署 | ✅ 已完成 | Vercel (前端) + Railway (Worker) |
| PDF 导出 | ❌ 未实现 | V2 功能 |
| 群体讨论模拟 | ❌ 未实现 | V2 功能 (persona 之间辩论) |
| 自定义 Persona | ❌ 未实现 | V2 功能 |
| 迭代对比 | ❌ 未实现 | V2 功能 (修改后重新评估，对比差异) |
| 团队协作 | ❌ 未实现 | V2 功能 |
| Google/GitHub OAuth | ❌ 未配置 | 代码结构支持，但未配置 Provider |
| Supabase Realtime | ❌ 未使用 | 改为客户端轮询 (3s 间隔) |
| 测试 | ❌ 未实现 | Worker 和前端均无测试 |

---

## Architecture

### 系统架构

```
Browser (Next.js 16 App Router)
    │
    ├── Supabase (PostgreSQL + Auth + Storage)
    │
    ├── Redis (Upstash, TLS via rediss://)
    │   └── BullMQ Queue ("evaluations")
    │
    └── AI Worker (Node.js, Railway)
        ├── Project parsing (LLM 解析用户输入)
        ├── Persona review orchestration (并行生成每个 persona 的评审)
        ├── Summary report generation (综合报告)
        └── Scenario simulation (Max plan: 社交影响力模拟)
```

### Tech Stack

- **Frontend + API:** Next.js 16 (App Router, Server Components + Client Components)
- **Database + Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Task Queue:** BullMQ + Upstash Redis (TLS)
- **Payments:** Stripe (Checkout Sessions + Customer Portal + Webhooks)
- **AI:** Anthropic Claude (via @anthropic-ai/sdk)
- **i18n:** next-intl (zh/en)
- **UI:** Tailwind CSS v4 + Shadcn/UI + Framer Motion
- **Deployment:** Vercel (frontend, 需手动 `npx vercel --prod --yes`) + Railway (Worker)

### 核心流程 (已实现)

1. 用户在输入框提交话题（文字 + 可选 URL + 可选文件附件）
2. Next.js API → 创建 project + evaluation → BullMQ 推送任务（模块级 Redis 单例，避免冷启动）
3. AI Worker 拉取任务 → 解析输入 → 为每个选中的 persona 生成评审
4. 所有 persona 评审完成 → Worker 生成综合报告
5. 前端通过轮询（3s）获取进度和结果
6. 用户查看文字报告 + 可切换到数值评分视图

---

## Data Model (已实现)

### users (Supabase Auth)
- id, email, avatar, locale (zh/en)

### subscriptions
- user_id
- plan: free | pro | max
- stripe_customer_id, stripe_subscription_id
- evaluations_used, evaluations_limit
- current_period_start, current_period_end

### projects
- id, user_id
- raw_input (原始用户输入)
- parsed_data: { name, description, target_users, competitors, goals, success_metrics }
- url (可选)
- attachments[] (PDF, 截图 — Supabase Storage)
- created_at

### evaluations
- id, project_id
- status: pending | processing | completed | failed
- selected_persona_ids[]
- created_at, completed_at

### persona_reviews
- id, evaluation_id, persona_id
- scores: { usability, market_fit, design, tech_quality, innovation, pricing }
- review_text (结构化评审)
- strengths[], weaknesses[]
- llm_model
- created_at

### summary_reports (1:1 与 evaluation)
- id, evaluation_id (UNIQUE)
- overall_score
- persona_analysis_summary
- multi_dimensional_analysis
- goal_assessment
- if_not_feasible: { modifications, direction, priorities, reference_cases }
- if_feasible: { next_steps, optimizations, risks }
- action_items[] (each with priority, expected_impact, difficulty)
- market_readiness: low | medium | high

### personas (平台维护, JSON 文件)
- 101 个预置 persona，11 层模型
- 分类: tech, product, design, business, marketing, consumer, student, executive, niche

---

## Persona 系统 (11 层模型, 已实现)

101 个 persona，每个由 11 层定义：

| 层 | 内容 |
|----|------|
| Layer 1: Identity | name, avatar, tagline, locale_variants (zh/en) |
| Layer 2: Demographics | age, gender, location, education, occupation, income_level |
| Layer 3: Social Context | family, social_circle, relationships_with_products |
| Layer 4: Financial Profile | wealth_level, spending, price_sensitivity, payment_preference |
| Layer 5: Psychology | MBTI, decision_making, cognitive_biases, emotional_state, risk_tolerance |
| Layer 6: Behaviors | daily_habits, product_evaluation criteria |
| Layer 7: Evaluation Lens | primary_question, scoring_weights, known_biases, blind_spots |
| Layer 8: Life Narrative | origin_story, turning_points, current_chapter, core_fear |
| Layer 9: Internal Conflicts | tensions + how they manifest in evaluations |
| Layer 10: Contextual Behaviors | when_impressed/skeptical/confused/bored, first_10_seconds |
| Layer 11: Latent Needs | stated_need, actual_need, emotional_need, unaware_need |

### Persona 分类分布

| 类别 | 数量 | 示例 |
|------|------|------|
| tech | ~20 | Full-stack Developer, CTO, DevOps |
| product | ~10 | Product Manager, Entrepreneur |
| design | ~10 | UI/UX Designer, Graphic Designer |
| business | ~10 | Investor, Business Analyst |
| marketing | ~10 | Marketing Expert, Growth Hacker |
| consumer | ~15 | Office Worker, Grandma, Driver |
| student | ~7 | CS Student, MBA Student, Art Student |
| executive | ~7 | CEO, VP Engineering, CMO, CFO, CPO |
| niche | ~12 | Lawyer, Doctor, Creator, Farmer, Monk |

---

## 页面结构 (已实现)

### Landing Page (`/[locale]`)
- ✅ Hero section + subtitle + CTA button
- ✅ Features grid (多元视角 / 深度报告 / 可执行洞察)
- ✅ How it Works 流程说明
- ✅ Persona showcase (展示 persona 卡片)
- ✅ CTA section

### Auth (`/[locale]/auth/login`, `/register`)
- ✅ Email + Password 登录/注册
- ✅ Supabase Auth callback
- ❌ Google/GitHub OAuth (代码支持但未配置 Provider)

### Dashboard (`/[locale]/dashboard`)
- ✅ 项目历史列表 (ProjectCard)
- ✅ 订阅用量指示器 (UsageBar: "本月已使用 X/Y 次讨论")
- ✅ 当前套餐显示
- ✅ 删除项目按钮 + 自定义确认对话框 (不用浏览器 confirm)
- ✅ 状态标签 (pending / processing / completed / failed)

### New Evaluation (`/[locale]/evaluate/new`)
- ✅ 2 步流程: 描述话题 → 选择 Persona
- ✅ 3 步指示器 (Describe → Select Personas → Discussion)
- ✅ ChatGPT 风格输入框 (文字 + URL 自动检测 + 文件附件)
- ✅ 返回时保留输入内容和文件 (组件始终挂载，CSS 隐藏)
- ✅ 文件上传使用原生 `<label>` (解决 textarea 聚焦时无法上传的问题)
- ✅ Persona 选择: 分类标签 + 筛选器 (年龄/性别/收入) + AI 推荐
- ✅ Start Discussion 按钮提交时显示旋转加载动画

### Progress (`/[locale]/evaluate/[id]/progress`)
- ✅ 3 步指示器 (步骤 3 高亮)
- ✅ 进度条 + persona 完成计数
- ✅ 所有 persona 从开始就显示旋转动画，完成后显示绿色对勾
- ✅ 全部 persona 完成后显示循环动画状态消息 (5 步)
- ✅ 波浪点动画基于文字中心轴对称跳动
- ✅ 完成后显示 "View Report" 按钮
- ✅ 失败状态提示
- ⚠️ 使用轮询 (3s) 而非 Supabase Realtime

### Result (`/[locale]/evaluate/[id]/result`)
- ✅ 文字报告为默认视图 (ReportTextView, ~1550 行)
  - ✅ 侧边栏目录导航
  - ✅ 分数弧形图 (Score Arc)
  - ✅ Executive Summary + Key Findings
  - ✅ Persona Perspectives (每个 persona 的观点 + 评分)
  - ✅ Consensus & Disagreements
  - ✅ Deep Analysis (维度分析 + 目标评估)
  - ✅ Recommendations (可行/不可行建议 + Action Items)
  - ✅ Scenario Simulation (Max plan)
- ✅ "View Numerical Scores" 按钮切换到数值评分视图
- ✅ 切换时滚动到页面顶部，返回时恢复滚动位置
- ✅ 数值评分视图 (ReportScoresView): 雷达图 + 评分卡片

### Pricing (`/[locale]/pricing`)
- ✅ Apple 风格对比布局 (3 列)
- ✅ Free / Pro / Max 三档
- ✅ 每档显示所有功能 (base + extras)，高档显示更多行
- ✅ ChatGPT/Claude 风格按钮状态 (Current Plan / Upgrade / Downgrade)
- ✅ "Most Popular" 标签 on Pro
- ✅ Stripe Checkout 集成
- ✅ Manage Billing (Stripe Customer Portal)

### Settings (`/[locale]/settings`)
- ✅ 语言切换 (中/英)
- ✅ 个人资料显示 (email)
- ✅ 订阅套餐显示

### Header
- ✅ 自定义 SVG Logo (三个重叠圆形)
- ✅ 导航链接 (Dashboard, New Discussion, Upgrade, Settings)
- ✅ 用户头像下拉菜单
- ✅ 语言切换器
- ✅ 正确的内边距对齐

---

## 定价 (已实现)

| | Free | Pro | Max |
|--|------|-----|-----|
| 每月讨论次数 | 1 | 10 | 40 |
| 每次最多 Persona | 3 | 10 | 20 |
| 报告类型 | 简要摘要 | 完整多维度报告 | 完整报告 + 场景模拟 |
| 共识分析 | 基础 | 深度多角度 | 深度多角度 |
| PDF 导出 | ❌ | ❌ 未实现 | ❌ 未实现 |
| 优先支持 | ❌ | ❌ | ✅ |
| 价格 | $0 | $20/月 | $100/月 |

### Max 专属: 场景模拟 (已实现)
模拟所有选中 persona 在同一物理空间（如聚会、会议、办公室）的社交互动。评估喜欢产品的 persona 是否会通过社交动态、口碑传播影响持怀疑态度的 persona。输出接受度变化报告。

---

## Design System

- **Background:** #0C0C0C (main), #141414 (cards), #1C1C1C (subtle)
- **Text:** #EAEAE8 (primary), #9B9594 (secondary), #666462 (muted)
- **Accent:** #E2DDD5 (warm cream), #C4A882 (gold)
- **Border:** #2A2A2A (default), #3A3A3A (hover)
- **Success:** #4ADE80
- **Error:** #F87171
- **Font:** System default (暖色深色主题)

---

## Worker 架构 (已实现)

```
worker/
├── src/
│   ├── index.ts              # BullMQ Worker 入口
│   ├── config.ts             # 环境变量配置
│   ├── queue.ts              # Queue + Redis 连接
│   ├── supabase.ts           # Supabase Admin Client
│   ├── llm/
│   │   ├── adapter.ts        # 抽象 LLM 接口
│   │   ├── claude.ts         # Claude 实现
│   │   └── openai-compatible.ts  # OpenAI 兼容实现
│   ├── processors/
│   │   ├── orchestrator.ts   # 主任务编排 (解析→评审→报告)
│   │   ├── parse-project.ts  # 解析用户输入为结构化数据
│   │   ├── recommend-personas.ts  # AI 推荐 persona
│   │   ├── persona-review.ts # 单个 persona 评审生成
│   │   ├── summary-report.ts # 综合报告生成
│   │   └── scenario-simulation.ts  # 场景模拟 (Max plan)
│   ├── prompts/              # 各步骤的 System Prompt
│   └── types/                # 共享类型定义
├── data/
│   └── personas.json         # 101 个 persona 定义
```

---

## API Routes (已实现)

| Route | Method | 功能 |
|-------|--------|------|
| `/api/health` | GET | 健康检查 |
| `/api/evaluations` | GET | 获取用户所有项目+评估 |
| `/api/evaluations` | POST | 创建新评估 (项目+评估+推送队列) |
| `/api/evaluations/[id]` | GET/DELETE | 获取/删除单个评估 |
| `/api/personas` | GET | 获取所有 persona |
| `/api/personas/recommend` | POST | AI 推荐 persona |
| `/api/projects/[id]` | DELETE | 删除项目 |
| `/api/stripe/checkout` | POST | 创建 Stripe Checkout Session |
| `/api/stripe/portal` | POST | 创建 Stripe Customer Portal |
| `/api/stripe/webhook` | POST | 处理 Stripe Webhook 事件 |

---

## 已修复的问题 (历史)

| 问题 | 修复方案 |
|------|---------|
| 报告页空白 | `summary_reports` 是 1:1 关系，Supabase 返回对象而非数组 |
| 删除用浏览器弹窗 | 改为 shadcn Dialog 自定义样式 |
| Dialog 从左上角出现 | 移除 slide-in 类，保留 zoom + fade |
| Max 功能比 Pro 少 | 改为每档显示所有功能 (base + extras) |
| Start Discussion 慢 | 改用模块级 Redis 单例，避免每次请求动态 import |
| 英文显示中文职业 | 使用 `identity.locale_variants.en.tagline` |
| 返回后输入丢失 | ProjectInput 始终挂载，CSS hidden 隐藏 |
| 输入文字后无法上传文件 | 改用 `<label>` 原生触发 file input |
| Start Discussion 无加载提示 | 按钮显示 Loader2 旋转动画 |
| 波浪点动画偏上 | 改为 translateY(3px)↔(-3px) 对称跳动 |
| 报告切换滚动位置 | useEffect + 多次延时 scrollTo 强制覆盖 |

---

## V2 Features (未实现)

| 功能 | 描述 | 优先级 |
|------|------|--------|
| PDF 导出 | 将报告导出为 PDF 文件 | 高 |
| 群体讨论模拟 | Persona 之间以对话形式辩论 | 中 |
| 自定义 Persona | 用户创建自定义 persona | 中 |
| 迭代对比 | 修改后重新评估，对比两次报告差异 | 中 |
| 团队协作 | 多用户共享项目和报告 | 低 |
| Google/GitHub OAuth | 社交登录 (代码结构已支持) | 高 |
| Supabase Realtime | 替换轮询为实时推送 | 低 |
| 测试覆盖 | Worker + 前端单元测试和集成测试 | 中 |
| Vercel 自动部署 | 配置 Git push 自动触发部署 | 高 |
| UI/Persona 视觉重设计 | 用创意 UI 设计替换当前基础样式 | 待定 |
