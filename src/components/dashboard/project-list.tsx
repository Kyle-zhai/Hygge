import { ProjectCard } from "./project-card";

interface ProjectListProps {
  projects: Array<{
    id: string;
    raw_input: string;
    parsed_data: { name?: string; description?: string } | null;
    created_at: string;
    evaluations: Array<{
      id: string;
      status: string;
      selected_persona_ids: string[];
      created_at: string;
      completed_at: string | null;
    }>;
  }>;
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
