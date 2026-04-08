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
      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input value={email} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{t("languageDesc")}</p>
          <div className="flex gap-2">
            <Button
              variant={locale === "zh" ? "default" : "outline"}
              size="sm"
              onClick={() => switchLocale("zh")}
            >
              中文
            </Button>
            <Button
              variant={locale === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => switchLocale("en")}
            >
              English
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("subscription")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{td("plan", { plan: plan.toUpperCase() })}</p>
          <p className="text-sm text-muted-foreground">
            {td("evaluationsUsed", { used: evaluationsUsed, limit: evaluationsLimit })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
