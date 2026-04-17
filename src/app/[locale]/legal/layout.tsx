import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-[#EAEAE8]">
      <nav className="mb-10 flex flex-wrap gap-6 text-sm text-[#A8A89E]">
        <Link href="/" className="hover:text-[#EAEAE8]">← Home</Link>
        <Link href="/legal/terms" className="hover:text-[#EAEAE8]">Terms</Link>
        <Link href="/legal/privacy" className="hover:text-[#EAEAE8]">Privacy</Link>
        <Link href="/legal/cookies" className="hover:text-[#EAEAE8]">Cookies</Link>
      </nav>
      <article className="prose prose-invert max-w-none">
        {children}
      </article>
    </div>
  );
}
