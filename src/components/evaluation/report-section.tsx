interface ReportSectionProps {
  title: string;
  borderColor?: string;
  children: React.ReactNode;
}

export function ReportSection({ title, borderColor = "border-l-[color:var(--accent-primary)]", children }: ReportSectionProps) {
  return (
    <section
      className={`rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6 border-l-4 ${borderColor}`}
    >
      <h2 className="mb-4 text-lg font-semibold text-[color:var(--text-primary)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
