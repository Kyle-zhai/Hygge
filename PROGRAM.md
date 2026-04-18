# Hygge 项目书

> 版本：v1.0｜撰写日期：2026-04-18｜作者：Hygge 产品团队
> 本文件面向潜在投资人、合作伙伴与新入团队成员，系统性介绍 Hygge 的愿景、产品、技术、商业模式与发展规划。
> 实时技术状态请参考 `STATUS.md`；本书聚焦"为什么做、做什么、怎么做、如何盈利、未来往哪去"。

---

## 1. 执行摘要

**Hygge** 是一款 AI 驱动的"多视角评估平台"（Multi-Perspective Evaluation Platform）。用户提交产品构想、话题或文件，系统调度多个具备差异化背景的 AI 角色（Persona），以圆桌讨论（Round Table）形式并行评审，输出综合报告、立场差异、观点漂移与情景模拟。

- **一句话定位**：让每一个创业者、产品经理、研究者、学生，都能在 90 秒内获得一场"专家评审会"。
- **核心差异化**：不是单一 AI 回答，而是多 Persona 的"立场冲突 + 可追溯引用 + 可对比基线"的结构化产出。
- **当前状态**：功能就绪度约 90%，代码层上线安全性已就绪；定价、合规、可观测、自动化测试、埋点、推荐系统代码框架全部完成。
- **盈利模型**：订阅制（Pro $20 / Max $50），LLM 毛利率约 93%，4 位 Pro 或 2 位 Max 用户即达盈亏平衡。
- **下一阶段焦点**：从"代码就绪"转向"运营就绪"——内容获客、转化漏斗优化、推荐增长、B2B 拓展。

---

## 2. 项目愿景

### 2.1 问题陈述

在创意、产品、研究、学习、求职等众多场景下，单一视角的 AI 输出存在三个系统性缺陷：

1. **同温层效应**：单一模型输出往往收敛到"最安全"的答案，缺少真正的对抗与冲突
2. **权威崇拜**：用户难以判断 AI 回答的可信度，缺少"从哪个视角看、引用了什么"的可追溯性
3. **比较困难**：当用户迭代方案时，很难在相同条件下评估"新版本相比旧版本好在哪"

传统的解决方案——找真人评审、参加创业营、在论坛发帖——成本高、周期长、反馈质量不稳定。

### 2.2 Hygge 的答案

**通过可配置、可复用的 AI Persona 集合，模拟真实世界的多元评审委员会。**

- 每个 Persona 有独立的背景、视角、方法论
- 所有评审支持"引用 + 可追溯"，杜绝 ghost citation
- 提供基线对比（Compare）功能，把"迭代了什么"做成结构化输出
- 社区市场（Marketplace）让用户发布、订阅、评分 Persona，形成网络效应

### 2.3 长期愿景

> **让 AI 评审从"单问单答"升级为"多方圆桌"，成为个人与团队决策流程的标配。**

三年内希望达到：
- 成为中英双语创业 / 产品 / 学术场景的默认评审工具
- 建立起高质量 Persona 创作者经济（类比 Notion 模板、Figma Community）
- 开放 API，嵌入到更多决策链路（产品需求评审、论文提案、投资备忘录）

---

## 3. 市场与用户

### 3.1 目标市场

| 市场层 | 规模（全球） | Hygge 切入点 |
|---|---|---|
| 创业者 / Indie Hacker | ~5,000 万 | Product 模式：构想验证、PMF 压测、定价策略评估 |
| 产品经理 / 设计师 | ~2,000 万 | 需求评审、竞品拆解、用户心智地图 |
| 研究者 / 研究生 | ~1,500 万 | 论文提案评审、文献多角度辩论、答辩预演 |
| 内容创作者 | ~1 亿 | Topic 模式：选题评估、辩论话题建构 |
| 求职者 / 升学 | ~3 亿 | 模拟面试、模拟答辩、简历多视角 review |

初期聚焦**中英双语的创业者 / PM / 研究者**，这三类用户共同特征是：愿意付费获得高质量反馈、有持续使用频率、对 AI 理解度高。

### 3.2 用户画像（核心三类）

**A. 独立创业者 Alex（Primary）**
- 28-42 岁，SaaS / 消费 App 赛道
- 痛点：找 advisor 成本高，Reddit / 推特反馈质量低且不结构化
- 愿付：$20-100/月 换高质量反馈
- 核心场景：PMF 评估、定价压测、竞品差异化验证
- 来源渠道：Twitter/X、Indie Hackers、Product Hunt、HN

**B. 产品经理 Priya（Primary）**
- 26-38 岁，一线互联网或 B2B SaaS
- 痛点：需求评审会 stakeholder 难凑齐；做跨部门沟通稿效率低
- 愿付：个人 $20-50，团队版 >$200/月
- 核心场景：需求书评审、用户旅程多角色代入、方案比较
- 来源渠道：LinkedIn、PM 社群、小红书、知乎

**C. 研究生 / 博士生 Raj（Secondary）**
- 22-32 岁，人文社科与商学院为主
- 痛点：导师反馈周期长；同行反馈缺结构
- 愿付：$20/月 或学生年费
- 核心场景：开题报告压测、文献多角度辩论、答辩演练
- 来源渠道：学校社群、小红书、Google

### 3.3 竞品对比

| 维度 | ChatGPT / Claude 直用 | Perplexity | Consensus.app | **Hygge** |
|---|---|---|---|---|
| 多 Persona 并行 | 需手工提示 | 无 | 无 | **默认提供，可复用** |
| 立场冲突可视化 | 无 | 无 | 无 | **观点漂移 / Positions 原生支持** |
| 引用可追溯 | 有限 | 有 | 有（学术） | **每句评审均引用** |
| 基线对比（迭代） | 无 | 无 | 无 | **Compare 模式原生** |
| 社区市场 | 无 | 无 | 无 | **Marketplace + Review** |
| 价格 | $20 | $20 | $8-20 | **$0 / $20 / $50** |

**Hygge 的护城河**：多 Persona 调度 + 结构化输出 + 社区 Persona 经济，三者形成复合壁垒。

---

## 4. 产品定义

### 4.1 核心用户旅程

```
登录（Supabase Auth，匿名即用）
  ↓
选择模式（Product 产品 / Topic 话题）
  ↓
提交输入（文本 / URL / 附件 PDF/Docx/图片/视频/音频）
  ↓
选择 Persona（官方库 + 自建 + 收藏 + Marketplace，最多 5-20 个）
  ↓
Realtime Discussion Feed（实时展示每个 Persona 的发言）
  ↓
综合报告（分数 / 优劣 / 立场 / 引用 / 情景模拟 / 观点漂移）
  ↓
进阶操作：Compare 对比 / Debate 辩论 / Share 分享 / PDF 导出
```

### 4.2 功能矩阵

#### 4.2.1 已上线能力

**评估核心**
- Product / Topic 双模式
- LLM 动态生成评分维度（非固定 6 维）
- 附件支持：PDF、Docx、图片（PNG/JPG/WebP/GIF）、视频（MP4/MOV）、音频（MP3/WAV）；单文件 25MB 上限
- Realtime Discussion Feed（Supabase Realtime 订阅）
- Compare 评估（基线 + 新版并排）
- Round Table Debate（Max 专属，Persona 之间多轮对话）

**Persona 系统**
- 官方 Persona 按 23 条 taxonomy 分组
- 自定义 Persona：从零创建 / 导入外部 Markdown
- 收藏 / 发布 / 软删除 / 多场景标签
- Marketplace：浏览 / 搜索 / 标签筛选 / 评分评论
- 侧边栏分类导航

**报告输出**
- 个人 Persona 评审（分数 / 优势 / 劣势 / 详细文本）
- 综合报告（Summary Report）
- 观点漂移 Opinion Drift（Pro/Max）
- 情景模拟 Scenario Simulation（Max）
- 立场分布 Positions & References（Pro/Max）
- 引用文字 Verbatim Quotes（Pro/Max）
- 分享链接 Share Links
- PDF 导出（Pro/Max）

**商业化**
- Stripe 订阅（Free / Pro $20 / Max $50）
- 支付失败 3 次后自动降级；Pause 事件处理；Promo code 支持；可选 trial
- Feature Gating 按 Plan 精细化控制
- 推荐系统（Referral）：每次兑换送 3 次评估额度
- 多工作区（Team Workspaces，Max 层面）

**合规与信任**
- Terms / Privacy / Cookies 三套独立页面
- 匿名 SSR 友好 session
- 数据留存策略明确
- Supabase RLS 全表启用

**可观测性**
- Sentry 前端 + Worker 异常上报
- BullMQ 结构化日志
- Worker 优雅关闭（SIGTERM/SIGINT）
- Cron 每日 03:00 UTC 清理死单
- Posthog 埋点（7 个核心转化事件）

#### 4.2.2 规划中能力（参见第 9 节路线图）

- 推荐链接落地页与 profile 页 UI
- 内容中心（use case / blog / docs）
- Annual Plan（-20%）+ 完整 Trial 流程
- API 接入（B2B Max 用户）
- Team Plan UI 完整化
- 创作者主页与付费 Persona 分成
- 英文市场本地化深度优化

### 4.3 产品原则

1. **立场冲突优于一致意见**：系统应鼓励 Persona 之间有观点差异
2. **可追溯优于精美**：每条评审必须有引用，宁可短也不虚构
3. **结构化优于散文**：输出必须能被用户复用到自己的文档 / 流程中
4. **社区优于中心化**：长期价值在 Persona 创作者经济，不在我们自己写的 Persona
5. **多语言第一**：中英双语从第一行代码开始，不是事后翻译

---

## 5. 技术架构

### 5.1 核心技术栈

| 层 | 技术选型 | 部署位置 | 理由 |
|---|---|---|---|
| 前端 | Next.js 16.2 App Router + React 19 + Tailwind v4 + Shadcn | Vercel (region `hkg1`) | React 服务器组件、低延迟回写 Supabase |
| 鉴权 / DB | Supabase Postgres + RLS + Auth | Supabase 云端 | RLS 安全模型成熟，匿名 SSR 友好 |
| 队列 | BullMQ over Upstash Redis (TLS) | Upstash | 事件驱动，稳定性好，可观测性高 |
| Worker | Node.js 独立进程，Docker 构建 | Railway | 海外可达阿里云 DashScope |
| LLM | 阿里云 DashScope（OpenAI-compatible） | Worker 内部 | 默认 `glm-5`，fallback `qwen3.6-plus → qwen3-32b → qwen3.6-flash` |
| 支付 | Stripe Subscription + Webhook | Vercel | 市场标准，国际支持完善 |
| 可观测 | Sentry、BullMQ 结构化 log、Posthog | 全栈 | 异常 / 性能 / 用户行为三视角 |
| Cron | Vercel Cron | Vercel | 每日死单清理 |
| CI | GitHub Actions | GitHub | Typecheck + lint + Vitest 三重门禁 |

### 5.2 数据流

```
┌──────────┐   ┌───────────┐   ┌────────┐   ┌──────────┐
│  用户    │ → │ Vercel API │ → │  Upstash│ → │  Railway │
│ (浏览器) │   │ (鉴权/限额) │   │  Redis  │   │  Worker  │
└──────────┘   └───────────┘   └────────┘   └────┬─────┘
      ↑                                          │
      │                          ┌──────────┐    │
      └──────────────────────────│ Supabase │ ←──┘
      Realtime 订阅               │ Postgres │
                                  └──────────┘
```

**关键边界**：
- 前端 + API Route 在 Vercel：鉴权、验证、限额、入队
- LLM 调用必须在 Railway Worker（Vercel 海外 region 无法访问 DashScope）
- Supabase 负责持久化 + Realtime 推送

### 5.3 安全模型

- **身份验证**：Supabase Auth，支持邮箱 + 匿名 + OAuth（Google/GitHub）
- **授权**：Row Level Security 全表启用，`auth.uid()` 作为主要隔离键
- **速率限制**：Upstash Ratelimit，按操作类别（evaluations 20/h、personas 30/h、debateMessages 120/h、llmSettings 10/15m）
- **输入校验**：`rawInput` 32KB 硬限制（前后端双重）；附件 25MB + MIME 白名单
- **密钥加密**：用户自提供的 LLM 凭证在 Worker 使用 libsodium 加密存储
- **支付安全**：Stripe Webhook 签名校验；3 次失败后自动降级；Pause 事件处理
- **CSRF**：SameSite cookie + Stripe portal session-based 回跳
- **CI 门禁**：每次 PR 必须通过 typecheck + eslint + vitest

### 5.4 成本效率设计

- **固定基础设施**：~$75/月（Vercel Pro + Railway + Supabase Pro + Upstash）
- **单次评估 Token 估算**：Pro 12 Persona ≈ 97K token；Max 20 Persona ≈ 140K token
- **LLM 单价**：DashScope Qwen-Plus 混合费率 ≈ ¥0.0014/1K（约 $0.0002/1K）
- **单用户月成本**：Pro $1.36 / Max $3.58（含 Stripe 手续费）
- **毛利率**：约 93%
- **盈亏平衡**：4 位 Pro 或 2 位 Max

### 5.5 架构冗余与稳定性

- LLM FallbackLLM 链（4 级降级）
- Worker `uncaughtException` 保护，不退出进程
- BullMQ job 失败自动回写 `error_message`
- Cron 每日清扫死单
- Worker 优雅关闭（SIGTERM/SIGINT）
- JSON 解析容错（`robustJsonParse` + `balanceStringQuotes`）
- Persona review 验证器 + 2 次重试
- 队列入队失败时自动回滚 project + evaluation + 退配额

---

## 6. 商业模式

### 6.1 定价方案

| 特性 | Free ($0) | **Pro ($20/月)** | **Max ($50/月)** |
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

**策略**：
- Free 是"体验钩子"，3 次足以让用户形成判断但不足以长期使用
- Pro 是核心付费层，覆盖 90% 的个人用户需求
- Max 面向重度用户与准 B2B（多工作区、无限 Persona、高级功能）

### 6.2 收入增长杠杆

| 杠杆 | 已就位 | 预期效果 |
|---|---|---|
| Promo Code | ✅ Stripe Checkout 已启用 | 节日促销、KOL 返利 |
| Trial（可选 X 天） | ✅ `STRIPE_TRIAL_DAYS` env | 预期提升 20-40% 转化 |
| Referral（推荐人 + 被推荐人送 3 次评估） | ✅ Migration + API 就位 | K-factor 目标 0.3 |
| Annual Plan（-20%） | ⏳ P2 | LTV 提升 30%+，减少 dunning |
| API 接入（B2B） | ⏳ P3 | Max 层延伸，单客年费 $600-2000 |
| Team Plan（multi-seat） | ⏳ P2-P3 | Workspaces migration 已有，UI 待完善 |

### 6.3 收入预测（保守）

假设：LTV/CAC 3x 为健康线，CAC 控制在 $10 以内（社交获客 + Referral）

| 时间 | 注册用户 | 付费转化 | Pro 占比 | MRR | 备注 |
|---|---|---|---|---|---|
| 月 1 | 500 | 5% (25) | 80% Pro | $800 | 启动期，靠 Product Hunt / Twitter |
| 月 3 | 2,500 | 7% (175) | 75% Pro | $5,800 | Referral + 内容初见效 |
| 月 6 | 8,000 | 8% (640) | 70% Pro | $22,000 | SEO / Blog 积累 |
| 月 12 | 25,000 | 10% (2,500) | 65% Pro | $95,000 | 包含 API / Team Plan |

**关键假设**：
- 付费转化率 5-10%（SaaS 行业均值 2-5%，Hygge 因免费层限制强、需求高频可上浮）
- 月流失率 <5%（高频工具黏性）
- CAC 在 $5-15 区间（社交 + SEO + Referral 主导）

### 6.4 成本结构（稳态）

| 项目 | 月成本 |
|---|---|
| Vercel Pro | $20 |
| Railway Worker × 2 replica | $25 |
| Supabase Pro | $25 |
| Upstash Redis | $10 |
| Stripe（手续费计入用户成本） | - |
| LLM 调用（按 DAU 变动） | 随增长 |
| Posthog / Sentry | 免费层 → $50 |
| 域名 + 邮件服务 | $10 |
| **固定月成本** | **~$90-140** |

---

## 7. 当前进度与里程碑

### 7.1 代码层完成度

根据 `STATUS.md` 最新评分（2026-04-18）：

| 维度 | 评分 | 关键完成项 |
|---|---|---|
| 🔒 CSO（安全） | **8.5/10** | Rate limit 全覆盖、MIME 白名单、Stripe 三重 webhook、RLS 全表 |
| 🧱 代码 / 基础设施 | **8/10** | Vitest + CI 门禁、Worker 可横向扩展、prompt 去重 |
| 🧪 QA / 用户体验 | **6/10** | 功能完整但需真机端到端验证 |
| 💰 收入 / 上线 | **8/10** | 定价统一、Posthog 埋点、Referral skeleton、Promo / Trial 支持 |
| **综合** | **~7.6/10** | 上线安全性就绪，运营基础设施齐备 |

### 7.2 已完成的关键里程碑

- ✅ 定价统一（三处代码 + 文档对齐）
- ✅ `rawInput` 32KB 守门 + Worker 二次校验
- ✅ 队列入队失败事务回滚
- ✅ Stripe 支付失败 / Pause / Promo Code 完整覆盖
- ✅ Rate limit 在 14+ 条写路径全覆盖
- ✅ 附件 MIME + 25MB 白名单（数据库 + 客户端）
- ✅ Vitest 最小测试集 + GitHub Actions CI 三重门禁
- ✅ Worker `EVAL_CONCURRENCY` 环境变量化
- ✅ Posthog 客户端 + 7 核心事件埋点
- ✅ Referral 系统 migration + API skeleton
- ✅ 关键路由 `maxDuration` 显式配置
- ✅ 删除 prompt 重复技术债
- ✅ STATUS.md 成为单一真源，PROGRESS.md 已清理

### 7.3 当前尚未完成（需业务 / 内容投入）

- ⏳ Evaluation failed → 一键重试 + 自动退额度 UI
- ⏳ rawInput tiktoken 精细估算
- ⏳ `uncaughtException` Sentry alert rule 接入 Slack
- ⏳ 8 项 QA 端到端验证清单（Persona 创建闭环、Marketplace、Publish 等）
- ⏳ 移动端适配
- ⏳ Referral 兑换 UI（profile 页 + `/r/[code]` 落地页）
- ⏳ Posthog 生产 key 配置

---

## 8. 风险分析

### 8.1 技术风险

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| DashScope 限速或单价上升 | 中 | 中 | FallbackLLM 4 级降级；毛利率留足缓冲（93%）；长期支持多 provider |
| Railway 单节点故障 | 中 | 高 | Worker 可横向扩展（`EVAL_CONCURRENCY`）；Supabase Realtime 容错 |
| Supabase RLS 策略漏洞 | 低 | 高 | 已全表启用 RLS；定期审计；上线前做第三方渗透测试 |
| LLM 输出质量不稳定 | 中 | 高 | JSON Mode + 验证器 + 2 次重试；ghost citation 防护 |

### 8.2 商业风险

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| 付费转化低于预期 | 中 | 高 | Posthog 埋点已就位；A/B 测试；Trial 机制 |
| 获客成本过高 | 中 | 中 | Referral K-factor 目标 0.3；SEO / 内容建设 |
| 竞品快速跟进 | 高 | 中 | 加速 Persona 创作者生态；沉淀 Marketplace 网络效应 |
| 监管（数据 / AI 合规） | 低 | 高 | Terms / Privacy 已就位；数据留存透明；支持用户数据删除 |

### 8.3 运营风险

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| 作弊 / 薅羊毛（Referral 刷量） | 中 | 中 | 一人仅能被推荐一次（`unique(referee_id)`）；限额；手工审计 |
| 不当内容（Persona 被滥用） | 中 | 中 | Marketplace 人工审核；Report 机制；明确社区守则 |
| 高峰期队列积压 | 低 | 中 | Worker 横向扩展；Cron 清扫；Sentry 告警 |

---

## 9. 发展路线图

### 9.1 P0（已完成）— 收款前必修

定价统一、rawInput 守门、事务回滚、Stripe dunning、LLM 稳定性、文档整合。

### 9.2 P1（已完成，代码层）— 上线后 30 天内修

自动化测试 + CI、Posthog 埋点、错误态 UX 框架、Worker 扩展、附件 MIME 白名单、Referral skeleton、Promo / Trial 支持。

### 9.3 P2（30-90 天）— 增长杠杆

**内容与获客**
- 5 篇 use-case 博客（创业 / PM / 研究 各覆盖）
- `/blog` 路由 + Markdown 驱动
- Landing 页 SEO 优化（结构化数据、OG 图片）
- Twitter / X 自动化分享集成

**转化优化**
- Trial 完整流程（Stripe 信用卡预授权 + 过渡文案）
- Annual Plan（-20%）
- Referral UI 落地（profile 页 + `/r/[code]`）
- Onboarding 优化（`026_onboarding_state` 已有 schema，UI 待增强）

**B2B 萌芽**
- Team Plan UI 完整化（基于 `029_team_workspaces`）
- 企业发票支持（Stripe 已原生）

### 9.4 P3（90 天以后）— 规模化

**平台化**
- API 接入（B2B Max 延伸）
- 创作者主页 + 付费 Persona 分成（GMV 15% 抽成）
- 多 LLM provider 切换（已有 `030_multi_provider_llm` migration，扩展用户自备 key）
- 英文市场本地化深度优化

**生态**
- 浏览器扩展（选中文本即启动评估）
- Slack / Discord Bot 接入
- Notion / Figma 插件（从文档直接发起评估）

**高级能力**
- PDF 高保真导出（当前路径需确认）
- Persona 版本管理 + diff 可视化
- 多人协作评审（多用户同时评论同一份 evaluation）
- Evaluation 模板（领域专属，如 YC 标准、NSF 标准）

### 9.5 长期愿景（12-24 个月）

- **Hygge 成为创业者决策流的默认工具**，Twitter / X 上形成"我的 Hygge 评分是 X"的口碑裂变
- **Marketplace 日活创作者 >500**，头部 Persona 月 GMV >$10K
- **API 客户 >50 家**，嵌入到其他 SaaS 的需求评审 / 研究工作流
- **ARR 目标 $1M-3M**，毛利率维持 80%+

---

## 10. 关键指标（KPIs）

### 10.1 北极星指标

**周活跃付费用户生成的 Evaluation 数**。这个指标同时反映获客（覆盖）、激活（付费）与粘性（频次）。

### 10.2 二级指标

| 类别 | 指标 | 目标（月 3） | 目标（月 12） |
|---|---|---|---|
| 获客 | 周新增注册 | 500 | 5,000 |
| 激活 | 注册 → 第 1 次评估 | 60% | 70% |
| 留存 | 次月留存 | 40% | 55% |
| 付费转化 | 免费 → Pro/Max | 7% | 10% |
| 收入 | MRR | $5,800 | $95,000 |
| 健康 | 月流失 | <7% | <4% |
| 生态 | Marketplace 发布 Persona | 50 | 2,000 |
| 增长 | Referral K-factor | 0.2 | 0.4 |

### 10.3 可观测埋点（Posthog）

已接入的 7 核心事件：

1. `signup_completed`
2. `first_evaluation_created`
3. `upgrade_cta_clicked`
4. `checkout_completed`
5. `persona_created`
6. `debate_started`
7. `evaluation_shared`

后续将根据转化漏斗补充（feature_gate_hit、paywall_viewed 等）。

---

## 11. 资源与组织

### 11.1 当前状态

单人开发（+ Claude Code 协作），重点聚焦：
- 代码架构与产品设计（个人）
- 日常迭代与 QA（Claude Code 协作）

### 11.2 扩张需求（假设 $500K 启动资金）

**关键角色（年 1 内）**
- 全栈工程师 × 1：Worker / 后端扩展
- 前端工程师 × 1：移动端适配 + UI 深化
- 增长运营 × 0.5-1：内容 / SEO / Referral
- 客户成功 × 0.3：B2B Max 客户响应

**非人力支出**
- LLM 费用：$500-3000/月（随用户量）
- 基础设施：$200-500/月
- 营销 / 内容：$2-5K/月
- 法务 / 合规：$3-5K（一次性，上线前渗透测试 + Terms 审阅）

### 11.3 不扩张的独立路径

如保持单人 / 极小团队，**聚焦**：
1. 核心 2-3 类用户深度打磨（Indie Hacker + PM）
2. Referral + 自发传播为主要获客
3. 不做 B2B，不做 API，不做 Team Plan
4. 追求小而美：ARR $100K-300K，毛利率 >90%，净利率 70%+

---

## 12. 结语

> Hygge 的核心赌注是：**当 AI 输出越来越同质化时，用户真正需要的不是"更强的模型"，而是"更多的视角"。**

我们用 9 个月把功能从 0 搭到 90% 完成度，把代码上线安全性做到行业水准；接下来 3 个月要用同样的专注去打通运营与增长，验证商业假设。

无论是独立前行还是引入资本，技术债已清、架构已稳、定价已对齐、观测已接入——这份项目书不仅是对外介绍，更是对自己的承诺：**从"代码就绪"走向"运营就绪"，再从"运营就绪"走向"收入就绪"。**

---

## 附录

### A. 文档索引
- **`STATUS.md`** — 实时技术状态、评分卡、上线清单
- **`CLAUDE.md`** / **`AGENTS.md`** — 协作规范
- **`supabase/migrations/`** — 33 条 schema 真源
- **`docs/superpowers/plans/`** — 原始设计档案
- **`docs/superpowers/specs/`** — 功能 spec

### B. 关键代码入口
- 评估 API：`src/app/api/evaluations/route.ts`
- Worker 主循环：`worker/src/index.ts`
- Persona 生成：`worker/src/processors/generate-persona.ts`
- Stripe Webhook：`src/app/api/stripe/webhook/route.ts`
- Referral API：`src/app/api/referrals/*`
- 限额引擎：`src/lib/rate-limit.ts`

### C. 联系方式
- 产品反馈：通过应用内 Feedback 按钮
- 商务合作：business@hygge.app（待启用）
- 技术讨论：Twitter/X @HyggeAI（待启用）

---

*本项目书每季度更新一次；重大战略调整即刻修订。版本历史见 Git。*
