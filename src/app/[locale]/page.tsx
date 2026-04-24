import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { LiveDemo } from "@/components/landing/live-demo";
import { PersonaShowcase } from "@/components/landing/persona-showcase";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { CtaSection } from "@/components/landing/cta-section";
import {
  ProductShowcase,
  type ShowcaseCopy,
} from "@/components/landing/product-showcase";
import {
  PricingSection,
  type PricingTier,
} from "@/components/landing/pricing-section";
import { FaqSection, type FaqItem } from "@/components/landing/faq-section";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const isZh = locale === "zh";

  const samplePersonas = [
    { name: "Alex Chen", category: "technical", tagline: isZh ? "全栈开发者" : "Full-Stack Developer", avatar: "/personas/1.png", mbti: "INTJ",
      description: isZh ? "严谨、逻辑性强、追求代码优雅。擅长系统设计与全栈架构,用数据和逻辑说话。" : "Rigorous, logical, and elegant code pursuer. Expert in system design and full-stack architecture." },
    { name: "Sarah Kim", category: "design", tagline: isZh ? "UX设计师" : "UX Designer", avatar: "/personas/2.png", mbti: "ENFP",
      description: isZh ? "热情、富有同理心、创意丰富。从用户角度思考问题,注重细节和美感。" : "Enthusiastic, empathetic, and creative. Thinks from the user's perspective with attention to detail." },
    { name: "James Liu", category: "product", tagline: isZh ? "产品经理" : "Product Manager", avatar: "/personas/3.png", mbti: "ENTJ",
      description: isZh ? "果断、有远见、目标导向。擅长统筹规划和优先级排序,天生的领导者。" : "Decisive, visionary, and goal-oriented. Natural leader skilled in planning and prioritization." },
    { name: "Maya Patel", category: "business", tagline: isZh ? "创业者" : "Entrepreneur", avatar: "/personas/4.png", mbti: "ESTP",
      description: isZh ? "大胆、行动力强、务实乐观。喜欢快速验证想法,失败了就迅速调整。" : "Bold, action-oriented, and pragmatic. Loves rapid validation and quick pivots." },
    { name: "Emma Wilson", category: "end_user", tagline: isZh ? "普通用户" : "End User", avatar: "/personas/5.png", mbti: "ISFJ",
      description: isZh ? "温和、注重实用性、偏好简单操作。代表大众用户的声音。" : "Gentle, practical, and prefers simplicity. Represents the voice of everyday users." },
    { name: "David Park", category: "data", tagline: isZh ? "数据分析师" : "Data Analyst", avatar: "/personas/6.png", mbti: "ISTJ",
      description: isZh ? "细致、严谨、数据驱动。一切凭数据说话,可靠的分析伙伴。" : "Meticulous, rigorous, and data-driven. Everything backed by data, a reliable analyst." },
    { name: "Olivia Brown", category: "marketer", tagline: isZh ? "增长营销" : "Growth Marketer", avatar: "/personas/7.png", mbti: "ENFJ",
      description: isZh ? "外向、善于说服、创意与策略并重。擅长讲故事和制造传播点。" : "Outgoing, persuasive, blending creativity with strategy. Expert storyteller and growth hacker." },
    { name: "Ryan Zhang", category: "technical", tagline: isZh ? "后端工程师" : "Backend Engineer", avatar: "/personas/8.png", mbti: "ISTP",
      description: isZh ? "沉稳、务实、擅长底层架构。对系统稳定性有近乎偏执的追求。" : "Calm, practical, and skilled in low-level architecture. Obsessed with system stability." },
    { name: "Lisa Wang", category: "design", tagline: isZh ? "视觉设计" : "Visual Designer", avatar: "/personas/9.png", mbti: "INFP",
      description: isZh ? "感性、富有艺术气息、追求美学极致。对色彩和构图有天生的敏感度。" : "Sensitive, artistic, and aesthetically driven. Naturally attuned to color and composition." },
    { name: "Tom Anderson", category: "product", tagline: isZh ? "产品策略" : "Product Strategist", avatar: "/personas/10.png", mbti: "INTP",
      description: isZh ? "深思熟虑、系统性思维、对市场趋势敏锐。安静但见解深刻。" : "Thoughtful, systematic thinker with keen market insight. Quiet but deeply insightful." },
    { name: "Kevin Lee", category: "business", tagline: isZh ? "风险投资" : "Venture Capitalist", avatar: "/personas/11.png", mbti: "ENTJ",
      description: isZh ? "精明、决断力强、关注ROI和可规模化。看项目一针见血。" : "Sharp, decisive, focused on ROI and scalability. Cuts straight to the point." },
    { name: "Anna Davis", category: "end_user", tagline: isZh ? "学生用户" : "Student User", avatar: "/personas/12.png", mbti: "ESFP",
      description: isZh ? "好奇、活泼、学习能力强。对新事物接受度高,代表年轻用户群体。" : "Curious, lively, and quick to learn. Highly receptive to new things, representing young users." },
  ];

  const features = [
    {
      iconName: "Brain" as const,
      title: isZh ? "深度 AI 推理" : "Deep AI Reasoning",
      desc: isZh
        ? "每位角色基于专业背景独立思考并回应,而不是千篇一律的 AI 套话。"
        : "Each persona reasons from their own professional lens — no generic AI boilerplate, no single-chatbot homogeneity.",
    },
    {
      iconName: "Globe" as const,
      title: isZh ? "12+ 多元视角" : "12+ Distinct Voices",
      desc: isZh
        ? "技术、设计、商业、用户、数据——一次讨论覆盖所有利益相关方的立场。"
        : "Technical, design, business, user, and data perspectives — every stakeholder you'd want at a real table.",
    },
    {
      iconName: "BarChart3" as const,
      title: isZh ? "文件与链接输入" : "Files & Links as Input",
      desc: isZh
        ? "上传 PDF、文档、图片,或粘贴 URL。角色会先读完原文再表达观点。"
        : "Upload PDFs, docs, images, or paste a URL. Every voice reads the source before weighing in.",
    },
    {
      iconName: "Shield" as const,
      title: isZh ? "共识 & 分歧检测" : "Consensus & Disagreement Detection",
      desc: isZh
        ? "自动识别一致意见与关键分歧点,让你一眼看懂哪里该继续挖。"
        : "Automatically surface where voices align and where they clash — so you know what still needs a decision.",
    },
    {
      iconName: "Zap" as const,
      title: isZh ? "BYOK · 自带密钥" : "BYOK · Bring Your Own Key",
      desc: isZh
        ? "接入你自己的 OpenAI、Anthropic 或 Qwen 密钥,数据走你的通道,账单你自己说了算。"
        : "Plug in your own OpenAI, Anthropic, or Qwen key. Your data, your provider, your bill.",
    },
    {
      iconName: "Layers" as const,
      title: isZh ? "中英双语原生" : "Bilingual by Design",
      desc: isZh
        ? "讨论、报告、角色立场——中英文都是一等公民,而不是机器翻译。"
        : "Discussions, reports, and persona voices are native in both English and Chinese — not machine-translated.",
    },
  ];

  const showcase: ShowcaseCopy = isZh
    ? {
        sectionOverline: "产品体验",
        sectionHeading: "不只是对话,而是可以拿去用的成品",
        sectionSubhead:
          "每一次讨论结束后,你得到的是结构化报告、可剪辑的辩论,以及两次会议之间的意见漂移——每一份都是可以直接塞进周会的交付物。",
        items: {
          reportBadge: "综合报告",
          reportTitle: "多维度报告,一眼看清共识与分歧",
          reportBody:
            "讨论一结束,Hygge 把每位角色的观点整理成结构化报告:共识度、维度评分、执行摘要、每位角色的核心立场——不再自己翻聊天记录。",
          reportBullets: [
            "共识度与关键分歧自动标记",
            "按维度打分,支持导出 PDF",
            "保留每位角色的原话摘录",
          ],
          debateBadge: "1v1 辩论",
          debateTitle: "两位立场对立的角色,正面交锋",
          debateBody:
            "不想要群戏?挑两位观点对立的角色来一场 1v1 辩论——多轮攻防,你做裁判。比「各执一词」更能逼出真正的论据。",
          debateBullets: [
            "多轮反驳,越来越接近本质",
            "立场可视化,看谁在退让",
            "适合拿来做方案汇报的反方论据库",
          ],
          compareBadge: "讨论对比",
          compareTitle: "看同一群人,在新信息下立场如何变化",
          compareBody:
            "把两次讨论并排对比——新增一条用户反馈、改一处产品方案,哪位角色态度软化了?哪位反而更坚定?这是很多团队拍板前缺的那一步。",
          compareBullets: [
            "并排查看两次讨论的立场矩阵",
            "自动高亮发生立场漂移的角色",
            "支持数据、文件、URL 作为「新信息」",
          ],
        },
        mock: {
          reportHeading: "Pro 定价讨论",
          reportConsensus: "12 位参与者 · 2 分钟前完成",
          reportConsensusValue: "共识度 78%",
          reportDimensions: [
            { label: "市场契合", score: 82 },
            { label: "定价合理性", score: 74 },
            { label: "用户感知", score: 68 },
            { label: "可规模化", score: 79 },
          ],
          reportSummary:
            "多数参与者认为 $20/月是清晰的甜蜜点,但前提是免费版足够让用户先感受到价值。Kevin 坚持 $30 筛出认真用户,是主要分歧点。",
          reportPersonaA: "James Liu",
          reportPersonaARole: "产品经理",
          reportPersonaAQuote:
            "$20 是甜蜜点。$10 读起来像没自信,$30 得解释半天。",
          reportPersonaB: "Kevin Lee",
          reportPersonaBRole: "风险投资人",
          reportPersonaBQuote:
            "都不够。$30 起步才能筛出真正愿意付费的人。",
          debateTopic: "应该免费开放 API 吗?",
          debateRoundLabel: "第 2 轮 · 2 位参与者",
          debateLeft: "Maya Patel",
          debateLeftRole: "创业者",
          debateLeftQuote:
            "免费 API 是最快的分发引擎,用量一上来自然有人愿意升级。",
          debateRight: "Ryan Zhang",
          debateRightRole: "后端工程师",
          debateRightQuote:
            "算力是真金白银。免费意味着你在给竞争对手补贴训练数据。",
          debateTag: "1v1",
          compareBefore: "讨论 A",
          compareAfter: "讨论 B · 新数据之后",
          compareRowLabel: "意见漂移",
          compareDelta: "4 位角色立场发生变化",
          compareRows: [
            { persona: "James Liu", before: "中立", after: "支持", shifted: true },
            { persona: "Kevin Lee", before: "反对", after: "反对", shifted: false },
            { persona: "Sarah Kim", before: "支持", after: "支持", shifted: false },
            { persona: "Emma Wilson", before: "中立", after: "支持", shifted: true },
          ],
        },
      }
    : {
        sectionOverline: "PRODUCT",
        sectionHeading: "Not just conversation. Something you can actually ship with.",
        sectionSubhead:
          "Every discussion ends with structured artifacts — a full report, a debate transcript, and a drift comparison. Things you can paste into a doc and defend in a meeting.",
        items: {
          reportBadge: "REPORTS",
          reportTitle: "A multi-dimensional report, not a chat log",
          reportBody:
            "When the room stops talking, Hygge hands you a structured report: consensus score, dimension ratings, executive summary, and each voice's key stance — ready to paste into a decision doc.",
          reportBullets: [
            "Consensus % and contested points auto-flagged",
            "Scored across custom or preset dimensions, PDF-ready",
            "Preserves each persona's verbatim key quotes",
          ],
          debateBadge: "1V1 DEBATE",
          debateTitle: "Pit two opposing voices against each other",
          debateBody:
            'Not in the mood for a panel? Drop two personas with opposing views into a multi-round 1v1 debate. Better at surfacing real arguments than the usual "everyone tastefully disagrees" chat.',
          debateBullets: [
            "Multi-round rebuttal — the argument actually sharpens",
            "Stance visualized so you can tell who's conceding",
            "Instant counter-argument bank for your next proposal",
          ],
          compareBadge: "OPINION DRIFT",
          compareTitle: "See how the same voices shift on new information",
          compareBody:
            "Stack two discussions side-by-side. Add one user interview or change the product plan — who softened? Who dug in? This is the last step most teams skip before they commit.",
          compareBullets: [
            "Side-by-side stance matrix across both discussions",
            "Shifted personas highlighted automatically",
            'Feed in data, files, or URLs as the "new input"',
          ],
        },
        mock: {
          reportHeading: "Pro pricing discussion",
          reportConsensus: "12 voices · completed 2m ago",
          reportConsensusValue: "Consensus 78%",
          reportDimensions: [
            { label: "Market Fit", score: 82 },
            { label: "Pricing Sanity", score: 74 },
            { label: "User Perception", score: 68 },
            { label: "Scalability", score: 79 },
          ],
          reportSummary:
            "The room agrees $20/mo is the sweet spot — but only if the free tier lets users feel the value first. Kevin holds out for $30 to filter serious buyers; the main tension point.",
          reportPersonaA: "James Liu",
          reportPersonaARole: "Product Manager",
          reportPersonaAQuote:
            "$20 is the sweet spot. $10 reads as insecure; $30 needs a story.",
          reportPersonaB: "Kevin Lee",
          reportPersonaBRole: "Venture Capitalist",
          reportPersonaBQuote:
            "Neither. Start at $30. Filter tire-kickers early.",
          debateTopic: "Should the API be free?",
          debateRoundLabel: "Round 2 · 2 voices",
          debateLeft: "Maya Patel",
          debateLeftRole: "Entrepreneur",
          debateLeftQuote:
            "A free API is the fastest distribution engine. Usage climbs, upgrades follow.",
          debateRight: "Ryan Zhang",
          debateRightRole: "Backend Engineer",
          debateRightQuote:
            "Compute costs real money. Free means you're subsidizing competitor training data.",
          debateTag: "1v1",
          compareBefore: "Discussion A",
          compareAfter: "Discussion B · after new data",
          compareRowLabel: "Opinion drift",
          compareDelta: "4 voices shifted stance",
          compareRows: [
            { persona: "James Liu", before: "Neutral", after: "Support", shifted: true },
            { persona: "Kevin Lee", before: "Oppose", after: "Oppose", shifted: false },
            { persona: "Sarah Kim", before: "Support", after: "Support", shifted: false },
            { persona: "Emma Wilson", before: "Neutral", after: "Support", shifted: true },
          ],
        },
      };

  const pricingTiers: PricingTier[] = isZh
    ? [
        {
          key: "free",
          name: "Free",
          price: "¥0",
          period: "/月",
          tagline: "先看看它是不是你要的东西。",
          features: [
            "每月 10 次讨论",
            "每次讨论最多 5 位角色",
            "摘要报告 + 共识分析",
            "中英双语界面",
          ],
          ctaText: "免费开始",
          ctaHref: `/${locale}/auth/register`,
        },
        {
          key: "pro",
          name: "Pro",
          price: "¥99",
          period: "/月",
          tagline: "给真正用它来做决策的你。",
          features: [
            "每月 20 次讨论",
            "每次讨论最多 12 位角色",
            "完整多维度报告 + PDF 导出",
            "意见漂移(讨论对比)",
            "圆桌模式 + 1v1 辩论",
            "自定义角色(最多 10 个)",
          ],
          ctaText: "升级到 Pro",
          ctaHref: `/${locale}/auth/register`,
          highlight: true,
          badge: "最受欢迎",
          footnote: "7 天无理由退款",
        },
        {
          key: "max",
          name: "Max",
          price: "¥299",
          period: "/月",
          tagline: "给团队、高频使用者、BYOK 玩家。",
          features: [
            "每月 60 次讨论",
            "每次讨论最多 20 位角色",
            "场景模拟 + 角色市场精选位",
            "无限自定义角色",
            "BYOK(自带 API 密钥)",
            "优先支持",
          ],
          ctaText: "立即升级",
          ctaHref: `/${locale}/auth/register`,
        },
      ]
    : [
        {
          key: "free",
          name: "Free",
          price: "$0",
          period: "/mo",
          tagline: "See if it's the thing you were hoping for.",
          features: [
            "10 discussions per month",
            "Up to 5 voices per discussion",
            "Summary report + consensus analysis",
            "English & Chinese, first-class",
          ],
          ctaText: "Get started free",
          ctaHref: `/${locale}/auth/register`,
        },
        {
          key: "pro",
          name: "Pro",
          price: "$20",
          period: "/mo",
          tagline: "For people who actually use it to decide things.",
          features: [
            "20 discussions per month",
            "Up to 12 voices per discussion",
            "Full multi-dimensional report + PDF export",
            "Opinion Drift (discussion compare)",
            "Round Table + 1v1 Debate",
            "Custom personas (up to 10)",
          ],
          ctaText: "Upgrade to Pro",
          ctaHref: `/${locale}/auth/register`,
          highlight: true,
          badge: "Most Popular",
          footnote: "7-day no-questions refund",
        },
        {
          key: "max",
          name: "Max",
          price: "$60",
          period: "/mo",
          tagline: "For teams, heavy users, and BYOK power players.",
          features: [
            "60 discussions per month",
            "Up to 20 voices per discussion",
            "Scenario Simulation + Marketplace featured slot",
            "Unlimited custom personas",
            "BYOK (bring your own API key)",
            "Priority support",
          ],
          ctaText: "Go Max",
          ctaHref: `/${locale}/auth/register`,
        },
      ];

  const faqItems: FaqItem[] = isZh
    ? [
        {
          q: "Hygge 和直接用 ChatGPT/Claude 有什么不同?",
          a: "单个聊天机器人给你的是「一种声音」。Hygge 把多个立场不同、专业背景不同的 AI 角色放在同一张桌子上,让他们真的互相辩论、达成共识或留下分歧——最后给你的是一份结构化报告,而不是一段模糊的总结。",
        },
        {
          q: "这些 AI 角色是真的不同,还是同一个模型换皮?",
          a: "每个角色都有独立的专业视角、立场倾向、MBTI 和沟通风格。我们在 prompt 层面强制他们从自己的身份出发,并且在讨论中会真的互相反驳——不是模型换个头像。",
        },
        {
          q: "支持哪些输入?只能打字吗?",
          a: "可以上传 PDF、Word、图片,或者直接粘贴网址——角色会先读完原文再发言。你也可以把一份产品方案扔进去,让 12 位角色拆解它。",
        },
        {
          q: "讨论数据会被用来训练模型吗?",
          a: "不会。付费计划下你还可以开启 BYOK(自带密钥),数据直接走你自己的 OpenAI / Anthropic / Qwen 通道,Hygge 只做编排。",
        },
        {
          q: "可以自己定义角色吗?",
          a: "Pro 支持最多 10 个自定义角色,Max 无限。你可以描述一个角色的专业背景、MBTI、沟通风格,也可以把现有角色作为模板改。",
        },
        {
          q: "我可以取消订阅吗?",
          a: "随时可以。订阅会持续到当前计费周期结束,期间不会扣新一期费用。Pro 用户还有 7 天无理由退款。",
        },
      ]
    : [
        {
          q: "How is this different from just using ChatGPT or Claude?",
          a: "A single chatbot gives you one voice. Hygge puts multiple AI personas with different expertise and different opinions at the same table, has them actually debate each other, and hands you a structured report — not a blurry summary.",
        },
        {
          q: "Are the personas really distinct, or is it the same model with different skins?",
          a: "Each persona has its own professional lens, stance bias, MBTI, and communication style, enforced at the prompt layer. They genuinely push back on each other during the discussion — it's not an avatar swap.",
        },
        {
          q: "What can I feed it? Is it just text?",
          a: "Upload PDFs, Word docs, images, or paste a URL — the personas read the source before they weigh in. You can drop in a product brief and let 12 voices take it apart.",
        },
        {
          q: "Will my discussions be used to train models?",
          a: "No. On paid plans you can also turn on BYOK (Bring Your Own Key), which routes data through your own OpenAI / Anthropic / Qwen provider. Hygge just orchestrates.",
        },
        {
          q: "Can I create my own personas?",
          a: "Pro includes up to 10 custom personas; Max is unlimited. You can define a persona's background, MBTI, stance bias, and communication style — or fork any existing persona as a starting point.",
        },
        {
          q: "Can I cancel anytime?",
          a: "Yes. Your subscription runs through the current billing period — no surprise rebill. Pro also includes a 7-day no-questions refund.",
        },
      ];

  const demoScript = {
    topicOverline: isZh ? "真实圆桌片段" : "A real round table",
    topicTitle: isZh
      ? "我们应该把 Pro 定在 $20/月,还是 $10/月起步?"
      : "Should we launch Pro at $20/mo, or start at $10?",
    perspectivesLabel: isZh ? "4 位参与者" : "4 perspectives",
    summaryLabel: isZh ? "讨论总结" : "Discussion Summary",
    consensusLabel: isZh ? "共识度 78%" : "Consensus 78%",
    thinkingLabel: isZh ? "思考中" : "Thinking",
    waitingLabel: isZh ? "等待中..." : "Waiting...",
    summaryText: isZh
      ? "大家一致认为 $20 更能传递产品价值,但必须搭配清晰的 Free 限额让用户先尝到甜头。三人推荐分层入场:$0 看见价值、$20 解锁完整体验。Kevin 坚持 $30 更能筛出认真的用户,属于主要分歧点。"
      : "The room agrees $20 signals value, but only if the Free tier lets users taste the product first. Three voices back a layered entry: $0 to prove value, $20 to unlock the full experience. Kevin holds out for $30 to filter serious users — the main point of tension.",
    personas: isZh
      ? [
          {
            id: "p1",
            name: "Sarah Kim",
            role: "UX 设计师",
            avatar: "/personas/2.png",
            stance: "support" as const,
            quote:
              "$20 更符合用户对 SaaS 的锚定价。但只有在免费版足够让他们感受到价值时,升级才会自然发生——否则定价再合理也没用。",
            tags: [
              { kind: "up" as const, label: "符合心智预期" },
              { kind: "down" as const, label: "依赖免费版诱饵" },
            ],
          },
          {
            id: "p2",
            name: "Kevin Lee",
            role: "风险投资人",
            avatar: "/personas/11.png",
            stance: "oppose" as const,
            quote:
              "都不够。早期应该是 $30 起步,筛出真正愿意付费的人。便宜 10 块钱换来的都是犹豫型用户,你会后悔的。",
            tags: [
              { kind: "up" as const, label: "提升 ARPU" },
              { kind: "down" as const, label: "吓退尝鲜用户" },
            ],
          },
          {
            id: "p3",
            name: "James Liu",
            role: "产品经理",
            avatar: "/personas/3.png",
            stance: "support" as const,
            quote:
              "$20 是甜蜜点。$10 让人觉得你不自信,$30 在这个品类里要解释半天。先 $20 跑三个月,看留存再决定要不要往上推。",
            tags: [
              { kind: "up" as const, label: "清晰定位" },
              { kind: "up" as const, label: "数据驱动试错" },
            ],
          },
          {
            id: "p4",
            name: "Emma Wilson",
            role: "普通用户",
            avatar: "/personas/5.png",
            stance: "neutral" as const,
            quote:
              "说实话我更关心免费版能做什么。$20 我会犹豫但可以接受,前提是先让我确定它值这个钱——别一开始就弹升级窗口。",
            tags: [
              { kind: "up" as const, label: "真实用户声音" },
              { kind: "down" as const, label: "对升级弹窗敏感" },
            ],
          },
        ]
      : [
          {
            id: "p1",
            name: "Sarah Kim",
            role: "UX Designer",
            avatar: "/personas/2.png",
            stance: "support" as const,
            quote:
              "$20 anchors well against other SaaS people pay for. But it only converts if the free tier actually lets them feel the value — otherwise your price is irrelevant.",
            tags: [
              { kind: "up" as const, label: "Anchors as real SaaS" },
              { kind: "down" as const, label: "Depends on free tier hook" },
            ],
          },
          {
            id: "p2",
            name: "Kevin Lee",
            role: "Venture Capitalist",
            avatar: "/personas/11.png",
            stance: "oppose" as const,
            quote:
              "Neither. Start at $30. You want to filter out tire-kickers early. The $10 you save bringing people in, you lose ten times over on churn and support.",
            tags: [
              { kind: "up" as const, label: "Higher ARPU" },
              { kind: "down" as const, label: "Scares off triers" },
            ],
          },
          {
            id: "p3",
            name: "James Liu",
            role: "Product Manager",
            avatar: "/personas/3.png",
            stance: "support" as const,
            quote:
              "$20 is the sweet spot. $10 reads as insecure; $30 needs a story. Ship at $20, watch 90-day retention, raise only if the data earns it.",
            tags: [
              { kind: "up" as const, label: "Clear positioning" },
              { kind: "up" as const, label: "Data-driven" },
            ],
          },
          {
            id: "p4",
            name: "Emma Wilson",
            role: "End User",
            avatar: "/personas/5.png",
            stance: "neutral" as const,
            quote:
              "Honestly I care more about what the free tier does. $20 is fine if I'm sure it's worth it — just don't hit me with an upgrade modal on day one.",
            tags: [
              { kind: "up" as const, label: "Authentic user voice" },
              { kind: "down" as const, label: "Hates upgrade nags" },
            ],
          },
        ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--bg-primary)]">
      <Header />
      <main className="flex-1">
        <HeroSection
          overline={isZh ? "AI 圆桌推演" : "ROUND TABLE DELIBERATION"}
          headline={t("hero")}
          subtitle={t("subtitle")}
          ctaText={t("cta")}
          ctaHref={`/${locale}/auth/register`}
          secondaryText={isZh ? "看实时演示" : "See it live"}
          secondaryHref="#live-demo"
          trustRow={{
            label: isZh ? "背后的模型生态" : "Powered by",
            items: [
              "OpenAI GPT-5",
              "Anthropic Claude 4",
              "Qwen 3.6",
              "BYOK Supported",
            ],
          }}
        />

        <div id="live-demo">
          <LiveDemo script={demoScript} />
        </div>

        <ProductShowcase copy={showcase} />

        <PersonaShowcase
          heading={isZh ? "认识您的讨论伙伴" : "Meet your discussion partners"}
          viewAllText={isZh ? "查看全部角色" : "View all personas"}
          viewAllHref={`/${locale}/auth/register`}
          personas={samplePersonas}
          hint={isZh ? "拖动旋转 · 悬停暂停 · 点击查看" : "Drag to spin · hover to pause · click to open"}
        />

        <FeaturesGrid
          overline={isZh ? "能力" : "CAPABILITIES"}
          heading={isZh ? "一张桌子,十二种思考方式" : "One table. Twelve ways of thinking."}
          subtitle={
            isZh
              ? "每个能力都是为「让讨论真的有用」服务的——不是为了显得 AI。"
              : "Every capability is here to make the discussion actually useful — not to look impressively AI."
          }
          features={features}
        />

        <PricingSection
          overline={isZh ? "定价" : "PRICING"}
          heading={isZh ? "每个计划都包含完整体验" : "Every plan ships the full experience"}
          subtitle={
            isZh
              ? "免费版足够让你判断它是不是你要的东西。需要更多讨论次数、更多角色、更深的分析,再升级。"
              : "The free plan is enough to know whether this is the thing you were hoping for. Upgrade only when you want more runs, more voices, or deeper analysis."
          }
          tiers={pricingTiers}
        />

        <FaqSection
          overline={isZh ? "常见问题" : "FAQ"}
          heading={isZh ? "决定之前,先搞清楚" : "Figure it out before you commit"}
          subtitle={
            isZh
              ? "没在这里?写信来问——我们会当新 FAQ 收录。"
              : "Not here? Write in — if it's a fair question, it becomes the next entry."
          }
          items={faqItems}
          footerLabel={isZh ? "还有疑问?" : "Still have questions?"}
          footerText={isZh ? "写信给: yn.zhai0205@gmail.com" : "Email: yn.zhai0205@gmail.com"}
          footerHref="mailto:yn.zhai0205@gmail.com"
        />

        <CtaSection
          overline={isZh ? "准备好了吗?" : "READY?"}
          headline={
            isZh
              ? "把一个问题,交给一整张桌子。"
              : "Take your question. Put it on the table."
          }
          subtitle={
            isZh
              ? "几分钟内召集 12 位立场不同的 AI 角色——看看他们真的会怎么讨论你的决定。"
              : "Convene twelve distinct AI voices in minutes. See what a real round table makes of your decision."
          }
          ctaText={t("cta")}
          ctaHref={`/${locale}/auth/register`}
          secondaryText={isZh ? "查看定价" : "See pricing"}
          secondaryHref="#pricing"
          footnote={isZh ? "不需要信用卡 · 立即使用" : "No credit card required · Start in seconds"}
        />
      </main>
      <Footer />
    </div>
  );
}
