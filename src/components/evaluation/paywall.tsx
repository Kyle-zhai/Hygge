"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface PaywallProps {
  locale: string;
  onDismiss?: () => void;
}

export function Paywall({ locale, onDismiss }: PaywallProps) {
  const t = useTranslations("paywall");
  return (
    <div
      role="alert"
      className="mx-auto mt-4 max-w-2xl rounded-2xl border border-[rgb(var(--accent-warm-rgb)/0.30)] bg-[color:var(--bg-tertiary)] p-6 text-[color:var(--text-primary)] shadow-lg"
    >
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{t("heading")}</h2>
      <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t("body")}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href={`/${locale}/pricing?reason=quota`}>{t("upgradeCta")}</Link>
        </Button>
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss}>
            {t("dismiss")}
          </Button>
        )}
      </div>
    </div>
  );
}
