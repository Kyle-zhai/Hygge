import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0C0C0C]">
      <Header />
      <main className="container flex-1 py-8">{children}</main>
      <Footer />
    </div>
  );
}
