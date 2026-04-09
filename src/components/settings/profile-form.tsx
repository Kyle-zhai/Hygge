"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProfileFormProps {
  email: string;
  plan: string;
  evaluationsUsed: number;
  evaluationsLimit: number;
}

export function ProfileForm({ email, plan, evaluationsUsed, evaluationsLimit }: ProfileFormProps) {
  const t = useTranslations("settings");
  const td = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <div className="space-y-6">
      <Card className="border-[#2A2A2A] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-[#EAEAE8]">{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#9B9594]">{t("email")}</Label>
            <Input
              value={email}
              disabled
              className="border-[#2A2A2A] bg-[#1C1C1C] text-[#EAEAE8] disabled:opacity-60"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-[#EAEAE8]">{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-[#9B9594]">{t("languageDesc")}</p>
          <div className="flex gap-2">
            <Button
              variant={locale === "zh" ? "default" : "outline"}
              size="sm"
              onClick={() => switchLocale("zh")}
              className={locale === "zh" ? "bg-[#E2DDD5] text-[#0C0C0C] hover:bg-[#D4CFC7]" : "border-[#2A2A2A] text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"}
            >
              中文
            </Button>
            <Button
              variant={locale === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => switchLocale("en")}
              className={locale === "en" ? "bg-[#E2DDD5] text-[#0C0C0C] hover:bg-[#D4CFC7]" : "border-[#2A2A2A] text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"}
            >
              English
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-[#EAEAE8]">{t("subscription")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-[#EAEAE8]">{td("plan", { plan: plan.toUpperCase() })}</p>
          <p className="text-sm text-[#9B9594]">
            {td("evaluationsUsed", { used: evaluationsUsed, limit: evaluationsLimit })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
