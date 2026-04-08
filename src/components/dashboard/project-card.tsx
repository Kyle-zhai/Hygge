import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export async function ProjectCard({ project }: ProjectCardProps) {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = useLocale();
  const latestEval = project.evaluations[0];
  const title = project.parsed_data?.name || project.raw_input.slice(0, 60) + (project.raw_input.length > 60 ? "..." : "");
  const description = project.parsed_data?.description || project.raw_input.slice(0, 120);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">{title}</CardTitle>
          {latestEval && (
            <Badge variant="secondary" className={statusColors[latestEval.status] || ""}>
              {t(latestEval.status as "pending" | "processing" | "completed" | "failed")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(project.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
          </span>
          {latestEval && (
            <Button size="sm" variant="outline" asChild>
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
