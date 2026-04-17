import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { MarketplaceDetailClient } from "@/components/marketplace/detail-client";

export const dynamic = "force-dynamic";

export default async function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: persona } = await supabase
    .from("personas")
    .select(
      "id, identity, demographics, psychology, evaluation_lens, life_narrative, latent_needs, behaviors, description, tags, uses_count, source, creator_id, scenarios",
    )
    .eq("id", id)
    .eq("is_public", true)
    .eq("is_custom", true)
    .eq("is_active", true)
    .single();

  if (!persona) notFound();

  const { data: stats } = await supabase
    .from("persona_marketplace_stats")
    .select("review_count, average_rating")
    .eq("persona_id", id)
    .maybeSingle();

  const { data: reviews } = await supabase
    .from("persona_marketplace_reviews")
    .select("id, rating, content, created_at, author_id")
    .eq("persona_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: { user } } = await supabase.auth.getUser();
  let isSaved = false;
  let myReviewId: string | null = null;
  if (user) {
    const [saveRes, mineRes] = await Promise.all([
      supabase
        .from("persona_saves")
        .select("persona_id")
        .eq("user_id", user.id)
        .eq("persona_id", id)
        .maybeSingle(),
      supabase
        .from("persona_marketplace_reviews")
        .select("id")
        .eq("persona_id", id)
        .eq("author_id", user.id)
        .maybeSingle(),
    ]);
    isSaved = !!saveRes.data;
    myReviewId = mineRes.data?.id ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/${locale}/marketplace`}
        className="inline-flex items-center gap-1.5 text-xs text-[#9B9594] hover:text-[#EAEAE8] transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "zh" ? "返回市场" : "Back to marketplace"}
      </Link>

      <MarketplaceDetailClient
        locale={locale}
        personaId={persona.id}
        persona={persona as any}
        stats={stats ?? { review_count: 0, average_rating: null }}
        initialReviews={reviews ?? []}
        initialIsSaved={isSaved}
        canReview={!!user && user.id !== persona.creator_id}
        currentUserId={user?.id ?? null}
        hasOwnReview={!!myReviewId}
      />
    </div>
  );
}
