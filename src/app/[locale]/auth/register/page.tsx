"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/${locale}/dashboard`);
      router.refresh();
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="relative w-full max-w-md border-[#2A2A2A] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-semibold text-[#EAEAE8]">
            {t("registerTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#9B9594]">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#2A2A2A] bg-[#1C1C1C] text-[#EAEAE8] placeholder:text-[#666462] focus-visible:ring-[#E2DDD5] focus-visible:border-[#E2DDD5]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#9B9594]">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-[#2A2A2A] bg-[#1C1C1C] text-[#EAEAE8] placeholder:text-[#666462] focus-visible:ring-[#E2DDD5] focus-visible:border-[#E2DDD5]"
              />
            </div>
            {error && <p className="text-sm text-[#F87171]">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] font-semibold btn-glow"
              disabled={loading}
            >
              {loading ? tc("loading") : tc("register")}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#2A2A2A]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#141414] px-2 text-[#666462]">or</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-[#2A2A2A] bg-transparent text-[#EAEAE8] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
              onClick={() => handleOAuth("google")}
            >
              {t("loginWith", { provider: "Google" })}
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#2A2A2A] bg-transparent text-[#EAEAE8] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
              onClick={() => handleOAuth("github")}
            >
              {t("loginWith", { provider: "GitHub" })}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-[#666462]">
            {t("hasAccount")}{" "}
            <Link href={`/${locale}/auth/login`} className="text-[#E2DDD5] hover:text-[#D4CFC7] underline">
              {tc("login")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
