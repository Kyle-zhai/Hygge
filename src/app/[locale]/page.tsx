import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Users, FileBarChart, ListChecks } from "lucide-react";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = useLocale();

  const features = [
    { icon: Users, title: t("featurePersonas"), desc: t("featurePersonasDesc") },
    { icon: FileBarChart, title: t("featureReport"), desc: t("featureReportDesc") },
    { icon: ListChecks, title: t("featureAction"), desc: t("featureActionDesc") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {t("hero")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
          <Button size="lg" asChild>
            <Link href={`/${locale}/auth/register`}>{t("cta")}</Link>
          </Button>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 px-4 py-16">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
