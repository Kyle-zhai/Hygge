interface ReportSectionProps {
  title: string;
  borderColor?: string;
  children: React.ReactNode;
}

export function ReportSection({ title, borderColor = "border-l-primary", children }: ReportSectionProps) {
  return (
    <section className={`rounded-lg border bg-card p-6 border-l-4 ${borderColor}`}>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
