import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminPanel } from "@/components/admin/admin-panel";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Signed in as {admin.email}</p>
      </div>
      <AdminPanel />
    </div>
  );
}
