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
  processing: "border-[rgb(var(--accent-primary-rgb)/0.30)] bg-[rgb(var(--accent-primary-rgb)/0.10)] text-[color:var(--accent-primary)]",
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
    <Card className="card-glow border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] transition-all duration-300 hover:border-[color:var(--border-hover)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight text-[color:var(--text-primary)] flex-1">{title}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {latestEval && (
              <Badge
                variant="secondary"
                className={`border text-xs ${statusColors[latestEval.status] || "border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] text-[color:var(--text-secondary)]"}`}
              >
                {t(latestEval.status as "pending" | "processing" | "completed" | "failed")}
              </Badge>
            )}
            <DeleteProjectButton projectId={project.id} locale={locale} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 line-clamp-2 text-sm text-[color:var(--text-tertiary)]">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {new Date(project.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
          </span>
          {latestEval && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="border-[color:var(--border-default)] bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
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
