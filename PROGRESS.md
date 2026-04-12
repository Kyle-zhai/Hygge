# Hygge — 项目进展与规划

> 最后更新：2026-04-12

## 产品定位

Hygge 是一个 AI 驱动的多视角评估平台（Round Table Discussion）。用户提交产品描述或话题，系统模拟多个 AI 角色（Personas）从不同背景、专业、价值观出发进行讨论和评分，生成综合分析报告。

### 核心架构

- **前端**：Next.js App Router + next-intl（中英双语）
- **后端**：Next.js API Routes + BullMQ Worker（异步 LLM 处理）
- **数据库**：Supabase (Postgres + RLS)
- **LLM**：Qwen API（OpenAI-compatible 接口），通过 `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` 配置
- **支付**：Stripe Subscription + Webhook
- **部署**：Vercel（Next.js 前端）+ 独立 Worker 服务

---

## 已完成功能

### 核心评估流程
- [x] 产品/话题双模式评估（Product Mode & Topic Mode）
- [x] LLM 解析用户输入 → 多 Persona 并行评审 → 综合报告生成
- [x] 实时讨论动态（Realtime Discussion Feed）替代进度条
- [x] 附件支持（图片、PDF）

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
- [x] Compare 功能（多次评估对比）

### 商业化
- [x] Stripe 订阅（Free / Pro / Max）
- [x] Webhook 自动处理 plan 变更、续费重置
- [x] 按 plan 特性门控（Feature Gating）

---

## 当前进行中

### Persona Marketplace & 自定义 Persona（进行中）

**目标**：让用户创建自定义 Persona 并在社区市场中分享。

#### 已完成
- [x] 数据库 Migration 013：personas 表新增 `creator_id`, `is_custom`, `is_public`, `source`, `uses_count`, `description`, `tags` 字段；新建 `persona_saves` 表
- [x] 定价重构（plans.ts）：Free $0 / Pro $35 / Max $89，含 Feature Gating
- [x] LLM Persona 生成 Prompt（`src/lib/prompts/generate-persona.ts`）
- [x] API Routes：
  - `POST /api/personas/create` — 创建自定义 Persona（通过 LLM 生成）
  - `GET /api/marketplace` — 浏览公开 Personas（搜索、标签、分页）
  - `POST/DELETE /api/personas/[id]/save` — 收藏/取消收藏
  - `POST/DELETE /api/personas/[id]/publish` — 发布/取消发布到市场
  - `GET /api/personas` — 返回三类：official / custom / saved
- [x] 前端页面：
  - `/marketplace` — 浏览市场（搜索、标签筛选、收藏按钮、分页）
  - `/personas` — 管理自己的 custom & saved personas
  - `/personas/create` — 创建 persona（From Scratch 表单 + Import External 文件上传）
- [x] 侧边栏新增 Marketplace 和 My Personas 导航

#### 待解决
- [ ] **Persona 生成 LLM 调用 400 错误**：API route 调用 Qwen API 返回 400，已添加详细错误日志，等待下次测试确认具体原因
- [ ] **Migration 013 未执行**：需要在 Supabase 上运行 `supabase/migrations/013_marketplace_custom_personas.sql`，否则 personas 表缺少新字段，insert 会失败

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

1. **修复 Persona 生成**
   - 解决 Qwen API 400 错误
   - 执行 Migration 013
   - 端到端测试 create → publish → marketplace browse → save → use in evaluation

2. **Marketplace 完善**
   - Persona 详情页（点击卡片查看完整信息）
   - 热门排序 / 最新排序
   - Featured personas（Max 用户优先展示）
   - 使用次数统计更新

3. **评估流程集成自定义 Persona**
   - 评估选 persona 时展示 custom + saved personas
   - Persona 选择面板分 tab（Official / Custom / Saved）

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

## 技术债务

- [ ] Worker 和 Next.js 共享 prompt 文件的方式需要统一（目前 `generate-persona.ts` 在两处各有一份）
- [ ] Vercel 环境变量仅配置了 Production，Preview 部署缺少 LLM 相关变量
- [ ] 部分 API route 缺少 rate limiting
- [ ] Persona insert 的字段依赖 migration 013，需确保已执行
