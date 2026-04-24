"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ProfileFormProps {
  email: string;
  plan: string;
  evaluationsUsed: number;
  evaluationsLimit: number;
}

export function ProfileForm({ email, plan, evaluationsUsed, evaluationsLimit }: ProfileFormProps) {
  const t = useTranslations("settings");
  const td = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <Card className="border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]">
        <CardHeader>
          <CardTitle className="text-[color:var(--text-primary)]">{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[color:var(--text-secondary)]">{t("email")}</Label>
            <Input
              value={email}
              disabled
              className="border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] text-[color:var(--text-primary)] disabled:opacity-60"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]">
        <CardHeader>
          <CardTitle className="text-[color:var(--text-primary)]">{t("subscription")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-[color:var(--text-primary)]">{td("plan", { plan: plan.toUpperCase() })}</p>
          <p className="text-sm text-[color:var(--text-secondary)]">
            {td("evaluationsUsed", { used: evaluationsUsed, limit: evaluationsLimit })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
