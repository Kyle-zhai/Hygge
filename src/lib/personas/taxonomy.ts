// Hierarchical taxonomy for topic-mode persona selection.
// Level 1: domain (4). Level 2: sub_domain (16). Level 3: dimensions (per sub-domain, multi-select).

export type DomainKey = "physical" | "social" | "intellectual" | "utility";

export type SubDomainKey =
  | "food" | "living" | "health" | "finance" | "geography"
  | "career" | "relationships" | "leisure" | "current_affairs"
  | "opinions" | "values" | "emotions" | "knowledge"
  | "planning" | "small_talk" | "help";

export interface TaxonomyLabel {
  key: string;
  label_en: string;
  label_zh: string;
}

export type Dimension = TaxonomyLabel;

export interface SubDomain extends TaxonomyLabel {
  key: SubDomainKey;
  domain: DomainKey;
  dimensions: Dimension[];
}

export interface Domain extends TaxonomyLabel {
  key: DomainKey;
}

export const DOMAINS: Domain[] = [
  { key: "physical",     label_en: "Physical & Material",   label_zh: "生存与物质" },
  { key: "social",       label_en: "Action & Social",       label_zh: "行为与社会" },
  { key: "intellectual", label_en: "Mind & Spirit",         label_zh: "精神与认知" },
  { key: "utility",      label_en: "Meta & Utility",        label_zh: "辅助与工具" },
];

export const SUB_DOMAINS: SubDomain[] = [
  // Physical & Material
  { key: "food", domain: "physical", label_en: "Food & Drink", label_zh: "饮食", dimensions: [
    { key: "restaurant", label_en: "Restaurants",   label_zh: "餐厅" },
    { key: "cooking",    label_en: "Cooking",       label_zh: "厨艺" },
    { key: "ingredients",label_en: "Ingredients",   label_zh: "食材" },
    { key: "beverages",  label_en: "Beverages",     label_zh: "饮品" },
  ]},
  { key: "living", domain: "physical", label_en: "Living", label_zh: "居住", dimensions: [
    { key: "real_estate",label_en: "Real Estate",   label_zh: "房产" },
    { key: "renovation", label_en: "Renovation",    label_zh: "装修" },
    { key: "home_decor", label_en: "Home & Decor",  label_zh: "家居" },
    { key: "housework",  label_en: "Housework",     label_zh: "家务" },
  ]},
  { key: "health", domain: "physical", label_en: "Health", label_zh: "健康", dimensions: [
    { key: "sleep",      label_en: "Sleep",         label_zh: "睡眠" },
    { key: "body_state", label_en: "Body State",    label_zh: "身体状态" },
    { key: "fitness",    label_en: "Fitness",       label_zh: "健身" },
    { key: "medical",    label_en: "Medical",       label_zh: "医疗" },
  ]},
  { key: "finance", domain: "physical", label_en: "Finance", label_zh: "财务", dimensions: [
    { key: "shopping",        label_en: "Shopping",        label_zh: "购物" },
    { key: "investing",       label_en: "Investing",       label_zh: "理财" },
    { key: "spending_mindset",label_en: "Spending Mindset",label_zh: "消费观" },
    { key: "saving",          label_en: "Saving",          label_zh: "省钱" },
  ]},
  { key: "geography", domain: "physical", label_en: "Geography", label_zh: "地理", dimensions: [
    { key: "weather",    label_en: "Weather",         label_zh: "天气" },
    { key: "transport",  label_en: "Transport",       label_zh: "交通" },
    { key: "urban_dev",  label_en: "Urban Development",label_zh: "城市建设" },
    { key: "environment",label_en: "Physical Environment", label_zh: "物理环境" },
  ]},

  // Action & Social
  { key: "career", domain: "social", label_en: "Career & Study", label_zh: "事业/学业", dimensions: [
    { key: "workplace", label_en: "Workplace Relations", label_zh: "职场关系" },
    { key: "skills",    label_en: "Skill Development",   label_zh: "技能提升" },
    { key: "kpi",       label_en: "KPI & Performance",   label_zh: "KPI" },
    { key: "campus",    label_en: "Campus Life",         label_zh: "校园生活" },
  ]},
  { key: "relationships", domain: "social", label_en: "Relationships", label_zh: "人际关系", dimensions: [
    { key: "family",       label_en: "Family",       label_zh: "家庭" },
    { key: "romance",      label_en: "Romance",      label_zh: "恋爱" },
    { key: "social_circle",label_en: "Social Circle",label_zh: "社交圈" },
    { key: "pets",         label_en: "Pets",         label_zh: "宠物" },
  ]},
  { key: "leisure", domain: "social", label_en: "Entertainment & Leisure", label_zh: "娱乐休闲", dimensions: [
    { key: "travel",  label_en: "Travel",             label_zh: "旅游" },
    { key: "gaming",  label_en: "Gaming",             label_zh: "游戏" },
    { key: "shows",   label_en: "Shows & Streaming",  label_zh: "追剧" },
    { key: "reading", label_en: "Reading",            label_zh: "阅读" },
    { key: "sports",  label_en: "Sports & Hobbies",   label_zh: "运动爱好" },
  ]},
  { key: "current_affairs", domain: "social", label_en: "Current Affairs", label_zh: "时事资讯", dimensions: [
    { key: "social_trends", label_en: "Social Trends", label_zh: "社会热点" },
    { key: "tech",          label_en: "Technology",    label_zh: "科技动态" },
    { key: "pop_culture",   label_en: "Pop Culture",   label_zh: "流行文化" },
  ]},

  // Mind & Spirit
  { key: "opinions", domain: "intellectual", label_en: "Opinions & Reviews", label_zh: "观点评论", dimensions: [
    { key: "event_views", label_en: "Views on Events",     label_zh: "事件评价" },
    { key: "aesthetics",  label_en: "Aesthetic Preferences",label_zh: "审美偏好" },
  ]},
  { key: "values", domain: "intellectual", label_en: "Values", label_zh: "价值观", dimensions: [
    { key: "life_goals",label_en: "Life Goals",     label_zh: "人生目标" },
    { key: "ethics",    label_en: "Ethics",         label_zh: "道德准则" },
    { key: "beliefs",   label_en: "Beliefs",        label_zh: "信仰" },
  ]},
  { key: "emotions", domain: "intellectual", label_en: "Emotions & Feelings", label_zh: "情绪感受", dimensions: [
    { key: "stress",      label_en: "Stress Management", label_zh: "压力管理" },
    { key: "happiness",   label_en: "Happiness",         label_zh: "幸福感" },
    { key: "mental_state",label_en: "Mental State",      label_zh: "心理状态" },
  ]},
  { key: "knowledge", domain: "intellectual", label_en: "Knowledge Sharing", label_zh: "知识分享", dimensions: [
    { key: "popsci",     label_en: "Pop Science",        label_zh: "科普" },
    { key: "philosophy", label_en: "Philosophy",         label_zh: "哲学" },
    { key: "experience", label_en: "Experience Sharing", label_zh: "经验总结" },
  ]},

  // Meta & Utility
  { key: "planning", domain: "utility", label_en: "Planning", label_zh: "计划安排", dimensions: [
    { key: "scheduling",label_en: "Scheduling",   label_zh: "约时间" },
    { key: "calendar",  label_en: "Calendar Sync",label_zh: "对日程" },
    { key: "todos",     label_en: "To-dos",       label_zh: "待办事项" },
  ]},
  { key: "small_talk", domain: "utility", label_en: "Small Talk", label_zh: "寒暄破冰", dimensions: [
    { key: "ice_breaker", label_en: "Ice-breakers",  label_zh: "破冰" },
    { key: "pleasantries",label_en: "Pleasantries",  label_zh: "客套" },
    { key: "casual_chat", label_en: "Casual Chat",   label_zh: "闲聊" },
  ]},
  { key: "help", domain: "utility", label_en: "Help & Consultation", label_zh: "求助/咨询", dimensions: [
    { key: "directions",     label_en: "Directions",     label_zh: "问路" },
    { key: "recommendations",label_en: "Recommendations",label_zh: "求推荐" },
    { key: "advice",         label_en: "Seeking Advice", label_zh: "寻求建议" },
  ]},
];

export function getDomain(key: DomainKey): Domain | undefined {
  return DOMAINS.find((d) => d.key === key);
}

export function getSubDomain(key: SubDomainKey): SubDomain | undefined {
  return SUB_DOMAINS.find((s) => s.key === key);
}

export function getSubDomainsForDomain(domain: DomainKey): SubDomain[] {
  return SUB_DOMAINS.filter((s) => s.domain === domain);
}

export function localizedLabel(item: TaxonomyLabel, locale: string): string {
  return locale === "zh" ? item.label_zh : item.label_en;
}

// ──────────────────────────────────────────────────────────────
// Product-mode taxonomy: 4 big categories × a few traits each.
// Two levels (category → traits). Simpler than the topic wizard.
// ──────────────────────────────────────────────────────────────

export type ProductCategoryKey = "utility" | "market" | "novelty" | "reliability";

export type ProductTrait = TaxonomyLabel;

export interface ProductCategory extends TaxonomyLabel {
  key: ProductCategoryKey;
  description_en: string;
  description_zh: string;
  traits: ProductTrait[];
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    key: "utility",
    label_en: "Utility",
    label_zh: "产品力",
    description_en: "Usability, tech quality, and feature depth",
    description_zh: "可用性、技术品质与功能深度",
    traits: [
      { key: "usability",      label_en: "Usability",       label_zh: "可用性" },
      { key: "tech_quality",   label_en: "Tech Quality",    label_zh: "技术品质" },
      { key: "power_features", label_en: "Power Features",  label_zh: "进阶功能" },
      { key: "user_research",  label_en: "User Research",   label_zh: "用户研究" },
    ],
  },
  {
    key: "market",
    label_en: "Market",
    label_zh: "市场力",
    description_en: "Market fit, positioning, and commercial model",
    description_zh: "市场契合、定位与商业模式",
    traits: [
      { key: "growth",         label_en: "Growth",          label_zh: "用户增长" },
      { key: "positioning",    label_en: "Positioning",     label_zh: "定位品牌" },
      { key: "business_model", label_en: "Business Model",  label_zh: "商业模式" },
      { key: "sales",          label_en: "Sales & CS",      label_zh: "销售落地" },
    ],
  },
  {
    key: "novelty",
    label_en: "Novelty",
    label_zh: "创新力",
    description_en: "Innovation, design flair, and differentiation",
    description_zh: "创新、设计与差异化",
    traits: [
      { key: "visual_design",  label_en: "Visual Design",   label_zh: "视觉设计" },
      { key: "disruption",     label_en: "Disruption",      label_zh: "颠覆创新" },
      { key: "frontier",       label_en: "Frontier Tech",   label_zh: "前沿技术" },
      { key: "experience",     label_en: "UX Innovation",   label_zh: "体验创新" },
    ],
  },
  {
    key: "reliability",
    label_en: "Reliability",
    label_zh: "生命线",
    description_en: "Risk, ops, security, and sustainability",
    description_zh: "风险、运维、安全与可持续性",
    traits: [
      { key: "ops_stability",  label_en: "Ops & Stability",   label_zh: "运维稳定" },
      { key: "security",       label_en: "Security",          label_zh: "安全合规" },
      { key: "financial",      label_en: "Financial Health",  label_zh: "财务健康" },
      { key: "risk",           label_en: "Risk & Resilience", label_zh: "风险韧性" },
    ],
  },
];

export function getProductCategory(key: ProductCategoryKey): ProductCategory | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.key === key);
}
