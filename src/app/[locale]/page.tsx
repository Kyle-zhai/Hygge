import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const locale = useLocale();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          {t("hero")}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
        <Button size="lg" asChild>
          <Link href={`/${locale}/auth/register`}>{t("cta")}</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
