# Hygge — PM/CEO 视角上线评估

> 撰写日期:2026-04-19
> 视角:产品经理 / CEO 的诚实评估,非工程视角
> 配套阅读:`STATUS.md`(技术真源)、`PROGRAM.md`(对外项目书)
> 本文档的目的是补充 STATUS.md 的工程视角盲点,聚焦"用户实际感受"和"上线后真实风险"

---

## 🚨 阻塞级(产品在这个状态不应上线)

### 1. 中文内容审核问题 = "双语"主张是破的
- Aliyun DashScope 对中文输出有强审核,topic 模式碰到稍微有立场的中文话题(政治、社会、商业争议)就 `data_inspection_failed` → 用户看到 "Discussion failed"
- 现有 fallback chain 在这个错误码下**根本不会切换** provider
- PROGRAM.md 写"中英双语第一" — 实际上中文用户在最容易付费的"有争议话题讨论"场景下系统性失败
- 这不是 bug,是**架构选择的后果**:全栈押注阿里云
- **这是会上小红书差评的级别的问题**

**修法**:要么把审核错误纳入 fallback 模式 + 配一个 Claude/Gemini 兜底,要么直接对中文用户切到 OpenAI/Claude。不修就别宣传"中英双语"。

### 2. 没有 admin 面板
- 创始人为了帮一个用户升级要写 SQL,意味着:
  - 无法处理客服请求(退款、调整额度、申诉)
  - 无法手动发推荐码 / 试用名额
  - 无法看用户行为快速诊断问题
  - 无法处理 Stripe 之外的支付场景(发票、对公)
- 上线一周内会被这个问题拖垮

**修法**:最小可用 admin 页面 — 按 email 查用户、看 evaluation 列表、改 plan、看 LLM 用量。

### 3. QA 6/10 但 STATUS 整体评分 7.6 — 加权有问题
- QA 是用户实际感受的唯一维度。代码 8 / CSO 8.5 但用户用起来 6,意味着产品**自我评价比真实体验高 30%**
- 列了 8 项未验证(persona 创建、marketplace、publish、my personas CRUD、错误态、onboarding、移动端、PDF) — 这些**全部是付费用户每周会碰到的核心动作**
- 任何一个挂了,Pro 用户次月不会续

**修法**:上线前必须把 8 项中至少 5 项跑通真机 + 录视频。否则等于盲发。

### 4. 没有移动端
- 目标用户(创业者、PM、研究生)50%+ 时间在手机上
- 灵感来了 → 想立刻提交一个 idea evaluation → 打开手机发现不能用 → 放弃
- Twitter/X / 小红书引流的用户 90% 第一次访问是手机
- 这一项一票否决"可以上线"

---

## 🟠 高优(不修会卡转化)

### 5. 付费转化漏斗里有大洞
PROGRAM.md 假设 5-10% 付费转化,但缺了:

| 缺的环节 | 实际后果 |
|---|---|
| Free 用户用完 3 次 evaluation 后看到的 paywall 文案 | 默默流失,没数据 |
| "Evaluation failed" 后是否退额度 + 一键重试 | 用户花了 1 次额度看到 fail → 直接卸载 |
| Trial 默认关闭(`STRIPE_TRIAL_DAYS=0`) | 列入 P2 但其实是 P0:0 转化曲线 |
| Onboarding(首次进来给一个 demo evaluation) | 注册→第一次评估 转化假设 60%,实际可能 20% |
| Referral UI(分享码、`/r/[code]` 落地页) | 假设 K=0.3,实际 0 |
| Social proof(testimonials / logos / "X 个评估已生成") | 信任度 = 0 |

**这些不是 P1 P2,是 P0**。代码"准备好了"不等于"能转化"。

### 6. Landing page 一屏 + 没有 demo 视频 + 没有可点的样例报告
- 用户来了 90 秒就走。一屏文字让他做什么决定?
- 缺一个 30 秒的 demo 视频(可以用 Loom 录)
- 缺一个 "看一份示例报告" 链接 — 直接给个 share link 进去看完整产出。这是说服 PM 用户的最强武器
- 缺 "X 个团队 / X 万次评估已生成" 的数字(可以 mock,创业期合理)

### 7. Pricing 页可能伤转化
- $20 / $50 价位,用户会问 "凭什么"。PLANS 配置没有"年付折扣" UI,没有 "比 ChatGPT 多了什么" 的对比表
- "60 evaluations/month" 对小白用户毫无意义 — 应该是 "评估 60 个 idea / 写 60 份需求评审报告"
- Max 多了 Scenario Simulation + Round Table Debate — 这俩名字听起来像玩具,需要重新包装(e.g. "压力测试模式"、"专家辩论模式")

### 8. 客服渠道 = 0
- PROGRAM.md 写 "通过应用内 Feedback 按钮" — 实际有这个按钮吗?
- email business@hygge.app 标"待启用"
- 没有 Discord / 微信群 / Twitter
- 用户付了 $20/月卡住了,他怎么联系你?

---

## 🟡 中等(影响增长上限,不影响发布)

### 9. Persona Marketplace 是空的
- PROGRAM.md 写的"护城河" — 实际有多少 published persona?如果 < 50,marketplace 就是空架子,逛进去的用户会立刻流失
- Cold start 解法:你和早期用户需要 **手动撒种** 50-100 个高质量 persona 上去

### 10. 单 LLM provider 风险被 fallback 假象掩盖
- fallback 4 级是 `glm-5 → qwen3.6-plus → qwen3-32b → qwen3.6-flash` — **全是阿里云**
- DashScope 一旦限速 / 调价 / 服务故障,你 100% 离线
- 加一个 Claude / Gemini 入口不是 P3,是上线第一周就该做的

### 11. STATUS.md 和 PROGRAM.md 在自我表扬
- 大量 "✅ 已完成"、"代码层就绪",但没有任何 "我们还不知道这能不能真正解决用户问题" 的诚实段落
- PROGRAM.md 第 3.3 节用 "Hygge 的护城河" 做小标题 — 这种语言适合给投资人看,不适合给自己看
- **如果拿这两份文档给一个真 VC,他会问:"你和多少真实付费用户聊过?"** 文档里没有任何用户访谈引用

### 12. 没有数据闭环
- Posthog 埋了 7 个事件,但 STATUS 里没说看板长什么样、谁在看、多久看一次
- 上线第一个月最重要的就是 funnel:landing → signup → first eval → second eval → upgrade。这个 funnel 需要每天看
- Sentry 告警没接 Slack — 出问题要等用户邮件投诉才知道

### 13. 法务页只是"有"而非"对"
- Terms 104 行、Privacy 100 行 — 是律师审过的还是 ChatGPT 生成的?
- 处理欧美用户(harvard email 已经有了),GDPR / CCPA 合规需要明确数据导出 / 删除接口
- 如果目标是上 Product Hunt,法务页粗糙会被 hacker news 嘲笑

---

## 🤔 战略问题(不是 todo,是要想清楚)

1. **到底是给谁做的?** PROGRAM.md 列了 5 类用户,5 类 = 0 类。第一年聚焦哪 1 类?
2. **"多 persona 评审"的场景说服力,和多少真用户验证过?** 这是最大风险。
3. **Marketplace 经济学**:计划 15% 抽成 — 卖家凭什么来你这平台?Notion 模板有 100 万用户基数。你 0 用户基数怎么 bootstrap?
4. **Aliyun 路径选择**:背后是成本(便宜 5×)还是地缘?如果是成本,为什么不开始就用 OpenRouter / Vercel AI Gateway 做 cost-routing?
5. **Hygge 这个名字 — 海外友好吗?** 丹麦语,英语用户念不出来,中文用户没语义关联。如果上线后要 rebrand 成本极高
6. **域名:hygge.app 真的注册了吗?**

---

## 上线前 2 周冲刺建议(不要继续加 feature)

**Week 1**:
- 把那 8 项 QA 清单跑完 + 录屏(2 天)
- 修中文内容审核 fallback(0.5 天)
- 搭最小 admin 页面(1 天)
- Paywall + 错误重试 UX(1.5 天)

**Week 2**:
- 移动端响应式过一遍核心 3 页(landing / evaluate / report)(2 天)
- 录 Demo 视频 + 准备 3 份样例报告 + 写 5 条 testimonial(找朋友/早期用户)(2 天)
- 接 Slack 告警 + Posthog dashboard(0.5 天)
- 上 50 个种子 persona(0.5 天)

然后再上 Product Hunt。否则会用一发子弹打了一颗哑弹,Product Hunt 流量错过就没了。
