import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteProjectButton } from "./delete-project-button";

interface Evaluation {
  id: string;
  status: string;
  selected_persona_ids: string[];
  created_at: string;
  completed_at: string | null;
}

interface ProjectCardProps {
  project: {
    id: string;
    raw_input: string;
    parsed_data: { name?: string; description?: string } | null;
    created_at: string;
    evaluations: Evaluation[];
  };
}

const statusColors: Record<string, string> = {
  pending: "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]",
  processing: "border-[#E2DDD5]/30 bg-[#E2DDD5]/10 text-[#E2DDD5]",
  completed: "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]",
  failed: "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]",
};

export async function ProjectCard({ project }: ProjectCardProps) {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const latestEval = project.evaluations[0];
  const title = project.parsed_data?.name || project.raw_input.slice(0, 60) + (project.raw_input.length > 60 ? "..." : "");
  const description = project.parsed_data?.description || project.raw_input.slice(0, 120);

  return (
    <Card className="card-glow border-[#2A2A2A] bg-[#141414] transition-all duration-300 hover:border-[#3A3A3A]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight text-[#EAEAE8] flex-1">{title}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {latestEval && (
              <Badge
                variant="secondary"
                className={`border text-xs ${statusColors[latestEval.status] || "border-[#2A2A2A] bg-[#1C1C1C] text-[#9B9594]"}`}
              >
                {t(latestEval.status as "pending" | "processing" | "completed" | "failed")}
              </Badge>
            )}
            <DeleteProjectButton
              projectId={project.id}
              confirmText={locale === "zh" ? "确定要删除这条记录吗？" : "Delete this record?"}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 line-clamp-2 text-sm text-[#666462]">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#666462]">
            {new Date(project.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
          </span>
          {latestEval && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="border-[#2A2A2A] bg-transparent text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
            >
              <Link
                href={
                  latestEval.status === "completed"
                    ? `/${locale}/evaluate/${latestEval.id}/result`
                    : latestEval.status === "processing" || latestEval.status === "pending"
                    ? `/${locale}/evaluate/${latestEval.id}/progress`
                    : "#"
                }
              >
                {latestEval.status === "completed" ? tc("viewResult") : t(latestEval.status as "pending" | "processing")}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
