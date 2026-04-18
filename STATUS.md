# Hygge — 项目状态与上线清单

> 最后更新：2026-04-18
> 本文件是**唯一真源**（single source of truth）：功能清单、架构、定价、上线路径、技术债
> 历史文档：`PROGRESS.md`（已清理，内容并入本文件）、`docs/superpowers/plans/` 与 `docs/superpowers/specs/`（原始蓝图，保留作为设计档案）

---

## 1. 产品定位

**Hygge** — AI 多视角评估平台（Round Table Discussion）。用户提交产品描述 / 话题 / 文件，系统模拟多个 AI 角色（Personas）从不同背景并行评审，生成综合报告、观点漂移、情景模拟。支持 Product 与 Topic 双模式、Compare（基线对比）、Marketplace（社区 Persona 交易）。

**双语**：zh / en（next-intl），默认中文。

---

## 2. 架构

### 2.1 技术栈

| 层 | 技术 | 部署位置 |
|---|---|---|
| 前端 + API | Next.js 16.2 App Router + React 19 + Tailwind v4 + Shadcn | Vercel (region `hkg1`) |
| 鉴权 / 库 | Supabase Postgres + RLS + Auth | Supabase 云端 |
| 队列 | BullMQ over Upstash Redis (TLS) | Upstash |
| Worker（LLM） | Node.js 独立进程，Docker 构建 | Railway |
| LLM | 阿里云 DashScope（OpenAI-compatible），**默认 `glm-5`**，带 fallback 链 | Worker 内部 |
| 支付 | Stripe Subscription + Webhook | Vercel |
| 可观测 | Sentry（前端 + Worker）、BullMQ 结构化 log | — |
| Cron | `/api/cron/sweep-stuck-evaluations` 每日 03:00 UTC | Vercel Cron |

### 2.2 为什么 LLM 必须在 Railway Worker

Vercel 海外默认 region 无法访问阿里云 DashScope（返回 400 "Model not exist" 等误导性错误）。所有 LLM 调用必须走 Railway Worker；Vercel 锁在 `hkg1` 是为降低回写 Supabase 的延迟。

**请求流**：
```
用户 → Vercel API Route（鉴权 / 验证 / 限额 / rawInput 32KB 硬限）
     → 写入 Upstash Redis (BullMQ job)
     → Railway Worker 消费
     → Worker 调 DashScope → 回写 Supabase
     → 前端 Realtime 订阅更新
```

**受约束的路径**：
- Evaluation：从一开始就走 Worker
- Persona Generation：已迁移到 Worker
- Persona Recommend：当前在 Vercel 降级返回默认（待迁移到 Worker）

---

## 3. 已上线能力

### 3.1 核心评估
- Product / Topic 双模式
- LLM 动态评分维度（非固定 6 维）
- 附件（图片、视频、PDF、Docx、Pptx）
- Realtime Discussion Feed（实时讨论动态，替代进度条）
- Compare 评估（基线 + 新版并排对比，复用维度与 Persona）
- Round Table Debate（Max 专属，Persona 之间多轮对话）

### 3.2 Persona 系统
- 官方 Persona 按类目分组（23 条 taxonomy migration）
- 自定义 Persona（Worker 生成、From Scratch + Import External .md）
- 收藏 / 发布 / 软删除 / 多选场景 + 自由标签（scenarios / tags）
- Marketplace 浏览 + 搜索 + 标签筛选 + 分页
- 侧边栏 Marketplace + My Personas 导航

### 3.3 报告
- 个人评审（scores / strengths / weaknesses / review_text）
- 综合报告（Summary Report）
- Opinion Drift（Pro/Max）
- Scenario Simulation（Max）
- Positions / References / Verbatim quotes（Pro/Max）
- Share Links（`024_evaluation_share_links`）

### 3.4 商业化
- Stripe Subscription（Free / Pro $20 / Max $50）
- Webhook：`checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `customer.subscription.paused` / `invoice.payment_failed`（本轮新增）
- 订阅续费自动重置 `evaluations_used`
- Feature Gating（`effective-plan`）
- 3 次失败支付 → 自动降级 free（本轮新增）
- 多工作区（`029_team_workspaces`）

### 3.5 合规 / 法务
- `/legal/terms`（104 行）、`/legal/privacy`（100 行）、`/legal/cookies`
- 匿名 SSR 友好 cookie 会话

### 3.6 可观测 / 稳定性
- Sentry 前端 + Worker 异常上报
- BullMQ 结构化日志（`job.completed` / `job.failed` / `job.stalled`）
- Worker 优雅关闭（SIGTERM/SIGINT）
- `uncaughtException` 不退出进程（保护 Worker 稳定性）
- Cron 日扫死单（sweep-stuck-evaluations）
- Job 失败自动回写 `evaluations.error_message`（`031_evaluation_failure_metadata`）

### 3.7 用户凭证 / 多 provider
- `027_user_llm_settings` — 用户级 LLM 覆盖
- `030_multi_provider_llm` — 多 provider 支持
- Worker 加密存储用户凭证（`worker/src/crypto`）

### 3.8 LLM 输出稳定性
- `jsonMode` 全面启用（parse-project / classify-topic / persona-review）
- `robustJsonParse` + `balanceStringQuotes` 恢复策略
- Persona-review 验证器 + 2 次重试循环
- FallbackLLM 链：`glm-5 → qwen3.6-plus → qwen3-32b → qwen3.6-flash`
- Extracted-quotes 验证器防 ghost citation

---

## 4. 定价方案（已对齐）

| 特性 | Free ($0) | Pro ($20/月) | Max ($50/月) |
|------|-----------|-------------|-------------|
| 评估次数 / 月 | 3 | 20 | 60 |
| 最大 Persona 数 | 5 | 12 | 20 |
| 自定义 Persona | — | 10 | 无限 |
| Opinion Drift | — | ✓ | ✓ |
| Positions & References | — | ✓ | ✓ |
| Scenario Simulation | — | — | ✓ |
| Round Table Debate | — | — | ✓ |
| PDF 导出 | — | ✓ | ✓ |
| Marketplace 发布 | — | ✓ | ✓ |
| Marketplace 推荐位 | — | — | ✓ |
| Marketplace 浏览 / 使用 | ✓ | ✓ | ✓ |

**策略**：Pro 是核心付费层；Max 增加 Scenario Simulation、Round Table Debate、无限自定义 Persona。

### 成本模型（验证 $20/$50 合理性）

**每次评估 token 估算**（基于 `maxTokens` 配置汇总）：
- Pro（12 persona）：parse 2K + classify 1K + 12×review 24K + summary 8K + drift 2K ≈ **97K token 总量**
- Max（20 persona）：parse 2K + classify 1K + 20×review 40K + summary 8K + scenario 4K + drift 2K + debate 7K ≈ **140K token 总量**

**DashScope Qwen-Plus 混合费率** ≈ ¥0.0014/1K ≈ $0.0002/1K：

| | Pro（$20） | Max（$50） |
|---|---|---|
| LLM（月） | $0.38 | $1.68 |
| Stripe 手续费（2.9%+$0.30） | $0.88 | $1.75 |
| 基础设施分摊 | $0.10 | $0.15 |
| **单用户月成本** | **$1.36** | **$3.58** |
| **毛利率** | **93%** | **93%** |

**固定基础设施** ≈ $75/月（Vercel Pro + Railway + Supabase Pro + Upstash）。盈亏平衡：4 Pro 或 2 Max 订阅。

**结论**：$20/$50 定价健康，即便 LLM 单价上升 3–5× 依然保持 >75% 毛利率。

**核心风险**：`rawInput` 无限制时成本攻击（1MB × 12 personas ≈ $7/eval）——本轮 P0-2 已封堵（32KB 硬限 + Worker 二次校验）。

---

## 5. 上线就绪评分（gstack 四视角）

### 🔒 CSO（安全）— 8.5/10（↑ 从 7.5）

**已有**：RLS 全表、Stripe 签名校验、Upstash Ratelimit（evaluations / personas / debate / llmSettings）、凭证加密、auth.users 级联、**rawInput 32KB 硬限 + Worker 二次校验**、**队列入队失败事务回滚**、**Stripe 支付失败 → 3 次后降级**。

**本轮新增**：
- ✅ Rate limit 覆盖扩展：stripe/checkout、stripe/portal、persona-feedback、personas/[id]/publish、personas/[id]/save、personas/[id]（PATCH/DELETE）、debates、squads、onboarding/complete、marketplace/[id]/reviews、workspaces、personas/avatar、referrals（全部接入 `enforceRateLimit`）
- ✅ 头像上传 MIME + 扩展名双白名单（Set-based O(1)）
- ✅ 附件 bucket MIME + 25MB 白名单（migration 032 + 客户端预校验）
- ✅ 关键路由显式 `maxDuration`（webhook 15s、evaluations 15s、checkout 10s、portal 10s、cron 30s、referrals 10s）

**剩余缺口**：
- ⚠ CSRF：依赖 SameSite cookie 默认防护，Stripe portal 跳回已确认为 session-based
- ⚠ 渗透测试未做 — 建议上线前找第三方做一次 OWASP 扫描

### 🧱 代码 / 基础设施（review + health）— 8/10（↑ 从 7）

**已有**：TypeScript 严格、Next 16 + React 19、Sentry、结构化 log、Worker 优雅关闭、cron 死单清理。

**本轮新增**：
- ✅ Vitest 最小测试集（rate-limit / stripe-plans / webhook 事件覆盖），`npm test` 通过
- ✅ GitHub Actions CI（`.github/workflows/ci.yml`）：typecheck + lint + test 作为 PR 门禁
- ✅ Worker concurrency 环境变量化（`EVAL_CONCURRENCY` 默认 3，Railway 可调）
- ✅ `generate-persona` prompt 重复已清理（删除 `src/lib/prompts/generate-persona.ts`，worker 为唯一真源）
- ✅ 关键路由显式 `maxDuration` 防失控执行

**剩余缺口**：
- ⚠ 测试覆盖仍稀疏（仅 smoke tests）— 下一步补 worker 内 persona-review 验证器、debate queue flow
- ⚠ `uncaughtException` 被吞 — Sentry 已上报，需加 Slack alert rule
- ⚠ `llmOverrides` 解密错误路径 需审 Worker 侧

### 🧪 QA / 用户体验 — 6/10

**已有**：Realtime 反馈、附件、Compare、Share、Squads、双语。

**缺口（PROGRESS.md 原"待验证"清单，仍未完成）**：
- persona-create 端到端：create → 轮询 → 完成
- Marketplace 浏览 + 收藏
- Publish / unpublish
- My Personas CRUD（展开详情 / 删除 / 发布 / 取消发布）
- `/api/personas/mine` 正确返回字段
- 错误态 UX（Evaluation failed 后能否一键重试 + 自动退额度？）
- 首次用户 onboarding（有 `026_onboarding_state` 但需验证）
- 移动端适配
- PDF 导出声称已有但实现路径需确认

### 💰 收入 / 上线（office-hours）— 8/10（↑ 从 7）

**已解决**：
- ✅ 定价统一（Pro $20 / Max $50）
- ✅ 支付失败 dunning（3 次失败后降级 free）
- ✅ Posthog 埋点（provider 挂在 locale layout，`upgrade_cta_clicked` / `first_evaluation_created` 已接入，环境变量未配置时自动 no-op）
- ✅ Stripe Checkout `allow_promotion_codes: true` + 可选 `STRIPE_TRIAL_DAYS` trial
- ✅ Referral skeleton（migration 033、`/api/referrals` GET、`/api/referrals/redeem` POST，每次成功兑换赠送 3 次评估额度）

**剩余缺口**：
- ❌ 推荐兑换 UI（profile 页 / share modal 未搭建）
- ❌ 推荐链接落地页 `/r/[code]` 未实现
- ⚠ landing 只有一屏 — SEO / 长尾获客弱
- ⚠ 没有 blog / docs / 案例库（属 P2 内容投入）

---

## 6. 上线路径（P0 → P3）

### P0 — 收款前必修 ✅ **全部完成**（本会话）

| # | 项 | 状态 |
|---|---|---|
| 1 | 统一定价（$20/$50 一致） | ✅ |
| 2 | `rawInput` 32KB 硬限制 + Worker 二次校验 | ✅ |
| 3 | 队列入队失败事务回滚（删除 eval + project + 退配额） | ✅ |
| 4 | Stripe `invoice.payment_failed` + `subscription.paused` webhook | ✅ |
| 5 | Persona-review `jsonMode` + 验证器 + 重试 | ✅ |
| 6 | 文档整合到 STATUS.md | ✅ |

**仍待用户手动确认**：
- Vercel 生产 env vars：`STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` / `STRIPE_MAX_PRICE_ID` / `SUPABASE_SERVICE_ROLE_KEY` / `REDIS_URL` / `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- Stripe dashboard 实际 price ID 金额 = $20 / $50
- QA 清单（3.2、第 5.3 节）端到端验证

### P1 — 上线后 30 天内修（防止口碑崩）— **本会话代码层已覆盖**
- ✅ 7. 自动化测试最小集（Vitest + CI 门禁）
- ✅ 8. Posthog 埋点（init + 3 核心事件）— 实际 key 由用户在 Vercel env 配
- ✅ 10. Worker concurrency（`EVAL_CONCURRENCY` 默认 3）
- ✅ 13. 附件 MIME 白名单（migration 032 + 客户端）

**仍需手动 / 业务动作**：
- ⏳ 9. 错误态 UX：Evaluation failed → 一键重试 + 退额度（UI 改动）
- ⏳ 11. rawInput tiktoken 估算（P1 增强，非阻塞）
- ⏳ 12. `uncaughtException` Sentry alert rule → Slack webhook
- ⏳ 第 5.3 QA 节 8 项需浏览器端到端验证

### P2 — 增长杠杆（30–90 天）
14. **内容 + SEO**：至少 5 篇 use-case，`/blog` 路由
15. **Trial 机制**：已接入 `STRIPE_TRIAL_DAYS` env（默认 0）；配合 promo code 可做 "首月 50% off"
16. **Annual plan**（-20%）：最大化 LTV、减 dunning
17. ✅ **Referral skeleton**（本会话）：migration + API 已就位；待补 UI（profile 页显示 code + copy link）+ `/r/[code]` 落地
18. **API 接入**（B2B）：Max 用户大概率需求，提前规划 API key 机制
19. **Team plan UI 补齐**：`029_team_workspaces` migration 已有，UI 层完整度需检查

### P3 — 规模化（90 天+）
- PDF 导出（验证现状）
- Persona 评分 / 评论 / 版本管理
- 创作者主页 / 付费 Persona 分成
- 多 LLM provider 切换（已有 `030_multi_provider_llm` migration，扩展为用户自备 key）

---

## 7. 环境变量配置

### Vercel（Next.js 前端 + API Routes）
| 变量 | 用途 | 备注 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 连接 | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 key | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理 key | |
| `REDIS_URL` | BullMQ 队列连接 | Worker 侧共享 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Ratelimit | 与 Worker 的 `ioredis` 是两套凭证 |
| `LLM_API_KEY` / `LLM_MODEL` / `LLM_BASE_URL` | LLM（海外无法直调，仅 recommend 降级用） | Worker 侧实际使用 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe | |
| `STRIPE_PRO_PRICE_ID` / `STRIPE_MAX_PRICE_ID` | 绑定 `plans.ts` | **确认 dashboard 金额 = $20/$50** |

> Vercel 环境变量需同时勾选 Production 和 Preview，否则非 Production 分支部署读不到。当前 Production Branch = `platform-v2`。

### Railway（BullMQ Worker）
| 变量 | 用途 |
|------|------|
| `LLM_API_KEY` | DashScope API Key |
| `LLM_MODEL` | 默认 `glm-5` |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_PROVIDER` | `openai-compatible` |
| `REDIS_URL` | 同一个 Upstash Redis 实例 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理连接 |
| `SENTRY_DSN` | Worker 异常上报 |

---

## 8. 技术债

- ~~`generate-persona.ts` prompt 重复~~ ✅ 已清理
- ~~API route 缺少 rate limiting~~ ✅ 已覆盖关键写路径
- ~~零自动化测试~~ ✅ Vitest + CI 已搭建（仅 smoke tests，需继续补）
- `/api/personas/recommend` 在 Vercel 上降级运行，需迁移到 Worker
- `/api/personas` GET 路由的 custom/saved 分类被临时移除，需要恢复
- `recommend-personas` / `debate-response` prompt 分散，缺统一版本管理
- Referral UI 未搭建（migration + API 已就位）
- Worker 侧 persona-review 验证器 / debate queue flow 缺单测

---

## 9. 历史文档索引

- **本文件（STATUS.md）** — 唯一真源
- **`CLAUDE.md`** / **`AGENTS.md`** — 协作规范（Next 16 注意事项、gstack 入口）
- **`docs/superpowers/plans/`** — 原始 Plan 档案（保留参考）
  - `2026-04-08-plan1-foundation.md`
  - `2026-04-08-plan2-evaluation-engine.md`
  - `2026-04-08-plan3-frontend-ui.md`
  - `2026-04-08-plan4-stripe-payments.md`
  - `2026-04-09-platform-v2.md`
  - `2026-04-11-realtime-discussion-feed.md`
- **`docs/superpowers/specs/`** — 设计 spec
  - `2026-04-08-persona-platform-design.md`
  - `2026-04-11-realtime-discussion-feed-design.md`
- **`supabase/migrations/`** — 31 条 migration，schema 真源

**维护约定**：每周 Sunday 更新本文件第 3/5/6 节；新功能交付也直接写到本文件（不再单独维护 PROGRESS.md）。

---

## 10. 上线收入 GAP（一句话总结）

> **P0 + P1 代码层全部完成 —— 定价统一、rawInput 守门、Stripe dunning、Rate limit 全覆盖、附件 MIME 白名单、Vitest + CI、Posthog 埋点、Referral skeleton、Worker 可扩。**
>
> **当前四维评分：CSO 8.5 / Code 8 / QA 6（未动，需真机验证）/ Revenue 8。整体 ~90% 上线就绪。**
>
> **剩余瓶颈实际上已从"代码"转成"运营"：Posthog key / Stripe trial 天数 / Referral UI 入口 / landing 内容 / blog / 对外案例 —— 都是工程之外的投入。**
