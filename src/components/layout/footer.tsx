import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const isZh = locale === "zh";

  const sections = [
    {
      title: isZh ? "产品" : "Product",
      links: [
        { href: `/${locale}/auth/register?next=/audit/new`, label: isZh ? "决策审计" : "Decision Audit" },
        { href: `/${locale}/auth/register?next=/evaluate/new`, label: isZh ? "圆桌讨论" : "Round Table" },
        { href: `/${locale}/auth/register?next=/debates`, label: isZh ? "辩论模式" : "Debate Mode" },
        { href: `/${locale}#pricing`, label: isZh ? "定价" : "Pricing" },
      ],
    },
    {
      title: isZh ? "公司" : "Company",
      links: [
        { href: "mailto:yn.zhai0205@gmail.com", label: isZh ? "联系我们" : "Contact" },
        { href: `/${locale}#faq`, label: "FAQ" },
      ],
    },
    {
      title: isZh ? "法律" : "Legal",
      links: [
        { href: `/${locale}/legal/privacy`, label: isZh ? "隐私政策" : "Privacy" },
        { href: `/${locale}/legal/terms`, label: isZh ? "服务条款" : "Terms" },
        { href: `/${locale}/legal/cookies`, label: isZh ? "Cookie 政策" : "Cookies" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[color:var(--border-default)] bg-[color:var(--bg-primary)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {t("appName")}
            </p>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-[color:var(--text-tertiary)]">
              {isZh
                ? "把高风险决策放上桌子,留下一份能签字的审计记录。"
                : "Put high-stakes decisions on the table, walk away with a signed audit trail."}
            </p>
          </div>
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                {section.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--border-default)] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-[color:var(--text-tertiary)]">
            &copy; {new Date().getFullYear()} {t("appName")}. {isZh ? "保留所有权利。" : "All rights reserved."}
          </p>
          <p className="text-xs text-[color:var(--text-tertiary)]">
            {isZh
              ? "为高风险决策设计 · 哈希链审计 · 双签合规归档"
              : "Built for high-stakes decisions · Hash-chain trail · Dual-sign archive"}
          </p>
        </div>
      </div>
    </footer>
  );
}
