"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const newLocale = locale === "zh" ? "en" : "zh";
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      className="text-[#666462] hover:text-[#EAEAE8] hover:bg-[#1C1C1C] text-xs font-medium"
    >
      {locale === "zh" ? "EN" : "\u4E2D\u6587"}
    </Button>
  );
}
