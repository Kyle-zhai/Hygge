import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { PersonaShowcase } from "@/components/landing/persona-showcase";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { CtaSection } from "@/components/landing/cta-section";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  // How it works steps
  const steps = [
    {
      step: "01",
      iconName: "MessageSquare" as const,
      title: t("featurePersonas"),
      desc: t("featurePersonasDesc"),
    },
    {
      step: "02",
      iconName: "Users" as const,
      title: t("featureReport"),
      desc: t("featureReportDesc"),
    },
    {
      step: "03",
      iconName: "FileBarChart" as const,
      title: t("featureAction"),
      desc: t("featureActionDesc"),
    },
    {
      step: "04",
      iconName: "ListChecks" as const,
      title: locale === "zh" ? "行动改进" : "Take Action",
      desc:
        locale === "zh"
          ? "根据评估结果优化您的产品和策略"
          : "Refine your product and strategy based on actionable evaluation insights.",
    },
  ];

  // Sample personas for showcase
  const samplePersonas = [
    { name: "Alex Chen", category: "technical", tagline: locale === "zh" ? "全栈开发者" : "Full-Stack Developer", avatar: "/personas/1.png", mbti: "INTJ",
      description: locale === "zh" ? "严谨、逻辑性强、追求代码优雅。擅长系统设计与全栈架构，用数据和逻辑说话。" : "Rigorous, logical, and elegant code pursuer. Expert in system design and full-stack architecture." },
    { name: "Sarah Kim", category: "design", tagline: locale === "zh" ? "UX设计师" : "UX Designer", avatar: "/personas/2.png", mbti: "ENFP",
      description: locale === "zh" ? "热情、富有同理心、创意丰富。从用户角度思考问题，注重细节和美感。" : "Enthusiastic, empathetic, and creative. Thinks from the user's perspective with attention to detail." },
    { name: "James Liu", category: "product", tagline: locale === "zh" ? "产品经理" : "Product Manager", avatar: "/personas/3.png", mbti: "ENTJ",
      description: locale === "zh" ? "果断、有远见、目标导向。擅长统筹规划和优先级排序，天生的领导者。" : "Decisive, visionary, and goal-oriented. Natural leader skilled in planning and prioritization." },
    { name: "Maya Patel", category: "business", tagline: locale === "zh" ? "创业者" : "Entrepreneur", avatar: "/personas/4.png", mbti: "ESTP",
      description: locale === "zh" ? "大胆、行动力强、务实乐观。喜欢快速验证想法，失败了就迅速调整。" : "Bold, action-oriented, and pragmatic. Loves rapid validation and quick pivots." },
    { name: "Emma Wilson", category: "end_user", tagline: locale === "zh" ? "普通用户" : "End User", avatar: "/personas/5.png", mbti: "ISFJ",
      description: locale === "zh" ? "温和、注重实用性、偏好简单操作。代表大众用户的声音。" : "Gentle, practical, and prefers simplicity. Represents the voice of everyday users." },
    { name: "David Park", category: "data", tagline: locale === "zh" ? "数据分析师" : "Data Analyst", avatar: "/personas/6.png", mbti: "ISTJ",
      description: locale === "zh" ? "细致、严谨、数据驱动。一切凭数据说话，可靠的分析伙伴。" : "Meticulous, rigorous, and data-driven. Everything backed by data, a reliable analyst." },
    { name: "Olivia Brown", category: "marketer", tagline: locale === "zh" ? "增长营销" : "Growth Marketer", avatar: "/personas/7.png", mbti: "ENFJ",
      description: locale === "zh" ? "外向、善于说服、创意与策略并重。擅长讲故事和制造传播点。" : "Outgoing, persuasive, blending creativity with strategy. Expert storyteller and growth hacker." },
    { name: "Ryan Zhang", category: "technical", tagline: locale === "zh" ? "后端工程师" : "Backend Engineer", avatar: "/personas/8.png", mbti: "ISTP",
      description: locale === "zh" ? "沉稳、务实、擅长底层架构。对系统稳定性有近乎偏执的追求。" : "Calm, practical, and skilled in low-level architecture. Obsessed with system stability." },
    { name: "Lisa Wang", category: "design", tagline: locale === "zh" ? "视觉设计" : "Visual Designer", avatar: "/personas/9.png", mbti: "INFP",
      description: locale === "zh" ? "感性、富有艺术气息、追求美学极致。对色彩和构图有天生的敏感度。" : "Sensitive, artistic, and aesthetically driven. Naturally attuned to color and composition." },
    { name: "Tom Anderson", category: "product", tagline: locale === "zh" ? "产品策略" : "Product Strategist", avatar: "/personas/10.png", mbti: "INTP",
      description: locale === "zh" ? "深思熟虑、系统性思维、对市场趋势敏锐。安静但见解深刻。" : "Thoughtful, systematic thinker with keen market insight. Quiet but deeply insightful." },
    { name: "Kevin Lee", category: "business", tagline: locale === "zh" ? "风险投资" : "Venture Capitalist", avatar: "/personas/11.png", mbti: "ENTJ",
      description: locale === "zh" ? "精明、决断力强、关注ROI和可规模化。看项目一针见血。" : "Sharp, decisive, focused on ROI and scalability. Cuts straight to the point." },
    { name: "Anna Davis", category: "end_user", tagline: locale === "zh" ? "学生用户" : "Student User", avatar: "/personas/12.png", mbti: "ESFP",
      description: locale === "zh" ? "好奇、活泼、学习能力强。对新事物接受度高，代表年轻用户群体。" : "Curious, lively, and quick to learn. Highly receptive to new things, representing young users." },
  ];

  const categories = [
    { key: "technical", label: locale === "zh" ? "技术" : "Technical" },
    { key: "design", label: locale === "zh" ? "设计" : "Design" },
    { key: "product", label: locale === "zh" ? "产品" : "Product" },
    { key: "business", label: locale === "zh" ? "商业" : "Business" },
    { key: "end_user", label: locale === "zh" ? "用户" : "End User" },
  ];

  // Features grid data
  const features = [
    {
      iconName: "Brain" as const,
      title: locale === "zh" ? "AI 驱动分析" : "AI-Powered Analysis",
      desc: locale === "zh" ? "每个角色通过专业视角提供深度评估，超越表层反馈" : "Each persona provides deep evaluation through their professional lens, going beyond surface-level feedback.",
    },
    {
      iconName: "Globe" as const,
      title: locale === "zh" ? "多元化视角" : "Diverse Perspectives",
      desc: locale === "zh" ? "覆盖技术、设计、商业、用户等维度的全面反馈" : "Comprehensive feedback spanning technical, design, business, and user dimensions.",
    },
    {
      iconName: "BarChart3" as const,
      title: locale === "zh" ? "量化评分" : "Quantified Scoring",
      desc: locale === "zh" ? "六维度评分体系，直观了解产品各方面表现" : "Six-dimension scoring system for intuitive understanding of product performance.",
    },
    {
      iconName: "Shield" as const,
      title: locale === "zh" ? "共识与分歧" : "Consensus & Disagreements",
      desc: locale === "zh" ? "自动识别各角色的共识与分歧，发现关键决策点" : "Automatically identify consensus and disagreements, revealing key decision points.",
    },
    {
      iconName: "Zap" as const,
      title: locale === "zh" ? "实时进度" : "Real-time Progress",
      desc: locale === "zh" ? "实时追踪评估进度，每个角色的反馈即时呈现" : "Track evaluation progress in real-time as each persona delivers their feedback.",
    },
    {
      iconName: "Layers" as const,
      title: locale === "zh" ? "可执行建议" : "Actionable Insights",
      desc: locale === "zh" ? "按优先级排列的具体行动项，附带影响评估和难度评级" : "Priority-ranked action items with impact assessment and difficulty ratings.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#0C0C0C]">
      <Header />
      <main className="flex-1">
        <HeroSection
          overline={locale === "zh" ? "AI 多视角讨论" : "AI-POWERED DISCUSSIONS"}
          headline={t("hero")}
          subtitle={t("subtitle")}
          ctaText={t("cta")}
          ctaHref={`/${locale}/auth/register`}
        />

        <PersonaShowcase
          heading={locale === "zh" ? "认识您的讨论伙伴" : "Meet your discussion partners"}
          viewAllText={locale === "zh" ? "查看全部角色" : "View all personas"}
          viewAllHref={`/${locale}/auth/register`}
          personas={samplePersonas}
          categories={categories}
          allLabel={locale === "zh" ? "全部" : "All"}
        />

        <HowItWorks
          heading={locale === "zh" ? "如何运作" : "How it works"}
          steps={steps}
        />

        <FeaturesGrid
          heading={locale === "zh" ? "为什么选择 Hygge" : "Why Hygge"}
          subtitle={
            locale === "zh"
              ? "结合 AI 深度分析与多元化视角，为您的决策提供全方位支持"
              : "Combining AI deep analysis with diverse perspectives to provide comprehensive support for your decisions."
          }
          features={features}
        />

        <CtaSection
          headline={
            locale === "zh"
              ? "准备好探索新的视角了吗？"
              : "Ready to explore new perspectives?"
          }
          subtitle={
            locale === "zh"
              ? "几分钟内开始多视角讨论。任何话题，多元洞察。"
              : "Start a multi-perspective discussion in minutes. Any topic, diverse insights."
          }
          ctaText={t("cta")}
          ctaHref={`/${locale}/auth/register`}
        />
      </main>
      <Footer />
    </div>
  );
}
