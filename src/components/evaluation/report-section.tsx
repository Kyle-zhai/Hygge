interface ReportSectionProps {
  title: string;
  borderColor?: string;
  children: React.ReactNode;
}

export function ReportSection({ title, borderColor = "border-l-[#E2DDD5]", children }: ReportSectionProps) {
  return (
    <section
      className={`rounded-xl border border-[#2A2A2A] bg-[#141414] p-6 border-l-4 ${borderColor}`}
    >
      <h2 className="mb-4 text-lg font-semibold text-[#EAEAE8]">
        {title}
      </h2>
      {children}
    </section>
  );
}
