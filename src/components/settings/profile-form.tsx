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
