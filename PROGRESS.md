# Hygge — 项目进展与规划

> 最后更新：2026-04-13

## 产品定位

Hygge 是一个 AI 驱动的多视角评估平台（Round Table Discussion）。用户提交产品描述或话题，系统模拟多个 AI 角色（Personas）从不同背景、专业、价值观出发进行讨论和评分，生成综合分析报告。

### 核心架构

- **前端**：Next.js App Router + next-intl（中英双语），部署在 **Vercel**（海外服务器）
- **后端**：Next.js API Routes（仅负责鉴权、验证、队列调度）+ **BullMQ Worker**（实际 LLM 处理）
- **Worker**：独立 Node.js 服务，部署在 **Railway**，通过 Docker 构建
- **数据库**：Supabase (Postgres + RLS)
- **消息队列**：Redis（Upstash），连接 Vercel API Routes 和 Railway Worker
- **LLM**：阿里云 DashScope Qwen API（OpenAI-compatible 接口），通过 `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` 配置
- **支付**：Stripe Subscription + Webhook

### 为什么 LLM 调用必须在 Worker（Railway）而不是 Vercel

**核心原因：Vercel 服务器在海外，无法访问阿里云 DashScope API。**

我们使用的 LLM 是阿里云的 Qwen API（DashScope），这是一个中国大陆的云服务。Vercel 的 Serverless Functions 默认运行在美国东部（iad1），从海外服务器调用 DashScope 会被拒绝（返回 400 "Model not exist" 等误导性错误）。

Railway Worker 部署在可以访问 DashScope 的网络环境中，因此所有 LLM 调用都必须通过 Worker 执行。

**架构流程**：
```
用户操作 → Vercel API Route（鉴权、验证、限额检查）
         → 写入 Redis 队列（BullMQ job）
         → Railway Worker 取出任务
         → Worker 调用 DashScope Qwen API
         → Worker 将结果写入 Supabase
         → 前端轮询/Realtime 获取结果
```

**受影响的功能**：
- Evaluation（评估生成）— 从一开始就走 Worker 队列
- Persona Generation（自定义 Persona 生成）— 最初直接在 Vercel 调用 LLM 导致失败，已迁移到 Worker
- Persona Recommend（Persona 推荐）— 目前在 Vercel 调 LLM 会失败，降级为返回默认推荐

---

## 已完成功能

### 核心评估流程
- [x] 产品/话题双模式评估（Product Mode & Topic Mode）
- [x] LLM 解析用户输入 → 多 Persona 并行评审 → 综合报告生成
- [x] 实时讨论动态（Realtime Discussion Feed）替代进度条
- [x] 附件支持（图片、PDF）
- [x] 动态评分维度：Product 和 Topic 模式的评分维度均由 LLM 根据每次问题动态生成，不再使用固定 6 维度

### Persona 系统
- [x] 内置多角色 Persona（按 category 分组）
- [x] Persona 选择面板（最多选 N 个，按 plan 限制）
- [x] 立场分类（Positive / Negative / Neutral）+ 立场徽章显示

### 报告功能
- [x] 个人评审详情（scores, strengths, weaknesses, review_text）
- [x] 综合报告（Summary Report）
- [x] Opinion Drift（观点漂移分析）— Pro/Max 专属
- [x] Scenario Simulation（情景模拟）— Max 专属
- [x] Positions（立场概览）— Pro/Max 专属
- [x] References（引用参考）— Pro/Max 专属

### 用户体验
- [x] 侧边栏导航 + 历史记录浮动菜单
- [x] 用户菜单弹窗（账户信息、剩余额度进度条、Plan 徽章、登出）
- [x] Squads 功能（Persona 组合预设）
- [x] Compare 功能重构：选择历史评估 → 提交新版文字/文件 → 复用同维度+同Persona再评 → 并排对比
- [x] Your Discussions 多选筛选器（Topic / Product / Compare）
- [x] Compare 会话以 Scale 图标显示在 Your Discussions 中

### 商业化
- [x] Stripe 订阅（Free / Pro / Max）
- [x] Webhook 自动处理 plan 变更、续费重置
- [x] 按 plan 特性门控（Feature Gating）

---

## 当前进行中

### Persona Marketplace & 自定义 Persona

**目标**：让用户创建自定义 Persona 并在社区市场中分享。

#### 已完成
- [x] 数据库 Migration 013 已执行：personas 表新增 `creator_id`, `is_custom`, `is_public`, `source`, `uses_count`, `description`, `tags` 字段；新建 `persona_saves` 表（`persona_id` 为 text 类型匹配 personas.id）
- [x] 定价重构（plans.ts）：Free $0 / Pro $35 / Max $89，含 Feature Gating
- [x] LLM Persona 生成迁移到 Worker：
  - `POST /api/personas/create` — 验证权限后推送 BullMQ 任务到 `persona-generation` 队列，返回 jobId
  - `GET /api/personas/create/status/[jobId]` — 前端轮询 job 状态
  - `worker/src/processors/generate-persona.ts` — Worker 端处理 LLM 调用并写入数据库
  - `worker/src/index.ts` — 注册第二个 Worker 监听 `persona-generation` 队列
- [x] 前端页面：
  - `/personas/create` — 创建 persona（From Scratch 表单含可展开高级选项 + Import External .md 文件上传）
  - `/marketplace` — 浏览市场（搜索、标签筛选、收藏按钮、分页）
  - `/personas` — My Personas 管理页面（展开查看详情、删除、发布到 Marketplace 确认弹窗）
- [x] API Routes：
  - `GET /api/marketplace` — 浏览公开 Personas
  - `GET /api/personas/mine` — 获取当前用户的自定义 Personas（含完整详情字段）
  - `DELETE /api/personas/[id]` — 软删除 Persona（设置 `is_active: false`，验证所有权）
  - `POST/DELETE /api/personas/[id]/save` — 收藏/取消收藏
  - `POST/DELETE /api/personas/[id]/publish` — 发布/取消发布到市场
- [x] 侧边栏新增 Marketplace 和 My Personas 导航
- [x] 统一所有代码使用 `LLM_API_KEY`，移除 `ANTHROPIC_API_KEY` 引用
- [x] Persona recommend 路由降级处理（DashScope 不可达时返回默认推荐）
- [x] Publish persona 支持多选适用场景（scenarios）和自由标签（tags）
- [x] Migration 015：personas 表新增 `scenarios text[]` 字段

### Compare 功能重构

**目标**：用户选择一次历史评估作为基线，提交新版文字/文件，系统复用基线评估的维度和 Personas 重新评审，并排展示两份报告的差异。

#### 已完成
- [x] Migration 014：evaluations 表新增 `comparison_base_id` 外键（指向基线评估）
- [x] `POST /api/evaluations/compare` — 创建比较评估（校验基线归属、复用 persona_ids + mode，关联 comparison_base_id）
- [x] Worker orchestrator：当 `comparisonBaseId` 存在时，从基线评估读取 `topic_classification` 而非重新生成维度
- [x] `CompareCreateView` — 两步流：选择历史评估 → 输入新版文字 + 上传附件 → 提交
- [x] `CompareResultView` — 并排对比：总分 + Delta 指示器、维度逐项对比、逐 Persona 评审对比、共识对比、行动项对比
- [x] 结果页自动检测 `comparison_base_id`，渲染 `CompareResultView`
- [x] 侧边栏 Your Discussions 显示 compare 记录（Scale 图标）
- [x] Your Discussions 多选类型筛选器（Topic / Product / Compare，金色激活态）
- [x] Topic 模式立场值（stance）映射为数值（5 级量表）以支持对比分数展示
- [x] 队列入队失败时回滚评估和项目记录，不扣额度

#### 待验证
- [ ] Persona 生成端到端测试（Worker 部署后验证 create → 轮询 → 完成流程）
- [ ] Marketplace 浏览和收藏功能测试
- [ ] Publish/unpublish 功能测试
- [ ] My Personas 页面功能验证（需部署后端到端测试）：
  - `/api/personas/mine` 是否正确返回当前用户的自定义 Personas
  - 展开卡片查看 Persona 完整详情（Demographics, Psychology, Evaluation Lens, Life Narrative, Latent Needs）
  - 删除 Persona（确认弹窗 → 调用 `DELETE /api/personas/[id]` → 列表刷新）
  - 发布到 Marketplace（确认弹窗 → 调用 `POST /api/personas/[id]/publish`）
  - 从 Marketplace 取消发布（确认弹窗 → 调用 `DELETE /api/personas/[id]/publish`）

#### 已知问题
- `/api/personas` GET 路由已简化为基础查询（不含 custom/saved 分类），避免 persona_saves join 导致 500 错误。My Personas 页面已改用独立端点 `/api/personas/mine`。
- Worker persona-review 已增加 scores 返回值校验，LLM 未返回有效 scores 时抛出明确错误

---

## 定价方案

| 特性 | Free ($0) | Pro ($35/月) | Max ($89/月) |
|------|-----------|-------------|-------------|
| 评估次数/月 | 3 | 20 | 60 |
| 最大 Persona 数 | 5 | 12 | 25 |
| 自定义 Persona | — | 10 个 | 无限 |
| Opinion Drift | — | ✓ | ✓ |
| Positions & References | — | ✓ | ✓ |
| Scenario Simulation | — | — | ✓ |
| PDF 导出 | — | ✓ | ✓ |
| Marketplace 发布 | — | ✓ | ✓ |
| Marketplace 推荐位 | — | — | ✓ |
| Marketplace 浏览/使用 | ✓ | ✓ | ✓ |

**策略**：Pro 是核心付费层，覆盖大部分用户需求；Max 仅增加重计算功能（Scenario Simulation、25 persona 上限）和特权。

---

## 未来规划

### 短期（近期迭代）

1. **验证 Persona 生成流程**
   - 确认 Railway Worker 正确处理 persona-generation 队列
   - 端到端测试 create → poll → complete → 在评估中使用
   - 将 persona recommend 也迁移到 Worker（目前在 Vercel 降级运行）

2. **Personas API 完善**
   - 恢复 `/api/personas` 的 custom/saved 分类功能（独立端点或安全 join）
   - 评估选 persona 时展示 custom + saved personas
   - Persona 选择面板分 tab（Official / Custom / Saved）

3. **Marketplace 完善**
   - Persona 详情页（点击卡片查看完整信息）
   - 热门排序 / 最新排序
   - Featured personas（Max 用户优先展示）
   - 使用次数统计更新

### 中期

4. **报告增强**
   - PDF 导出（Pro/Max）
   - 报告分享链接
   - 历史报告搜索和筛选

5. **用户体验优化**
   - Dashboard 数据概览（总评估数、常用 personas、趋势）
   - 评估模板（保存常用 persona 组合 + 输入模板）
   - 移动端适配优化

6. **国际化完善**
   - 所有新页面的中英文翻译
   - Persona 内容多语言支持

### 长期

7. **社区生态**
   - Persona 评分和评论
   - 创作者主页
   - Persona 版本管理

8. **企业功能**
   - Team plan（多人共享额度）
   - 私有 Persona 库
   - API 接入

9. **AI 能力提升**
   - 多轮讨论（personas 之间对话）
   - 自适应 persona 行为（根据历史评估优化）
   - 支持更多 LLM provider 切换

---

## 环境变量配置

### Vercel（Next.js 前端 + API Routes）
| 变量 | 用途 | 注意 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 连接 | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 key | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理 key | |
| `REDIS_URL` | BullMQ 队列连接 | 用于推送 job |
| `LLM_API_KEY` | DashScope API Key | Vercel 海外无法直接调 LLM，仅 recommend 降级用 |
| `LLM_MODEL` | 模型名 | `qwen-max` |
| `LLM_BASE_URL` | API 地址 | |
| `STRIPE_*` | Stripe 支付相关 | |

> 注意：Vercel 环境变量需同时勾选 Production 和 Preview，否则非 Production 分支部署读不到变量。当前 Production Branch 为 `platform-v2`。

### Railway（BullMQ Worker）
| 变量 | 用途 |
|------|------|
| `LLM_API_KEY` | DashScope API Key（实际调用 LLM 的地方） |
| `LLM_MODEL` | `qwen-max` |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_PROVIDER` | `openai-compatible` |
| `REDIS_URL` | 同一个 Upstash Redis 实例 |
| `SUPABASE_URL` | Supabase 连接 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理 key |

---

## 技术债务

- [ ] `generate-persona.ts` prompt 在 `src/lib/prompts/` 和 `worker/src/processors/` 各有一份，需要统一到共享位置
- [ ] `/api/personas/recommend` 在 Vercel 上无法调用 DashScope，需迁移到 Worker 或改用代理
- [ ] `/api/personas` GET 路由的 custom/saved 分类被临时移除，需要恢复
- [ ] 部分 API route 缺少 rate limiting
