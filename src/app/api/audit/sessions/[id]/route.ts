import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 10;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session, error: lookupErr } = await supabase
    .from("audit_sessions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (lookupErr || !session) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Signed-off audits are part of an immutable trail (hash-chain) and may
  // be referenced by compliance reviewers. Block deletion to preserve the
  // record. Users can archive instead via the existing signoff flow.
  if (session.status === "signed_off") {
    return NextResponse.json(
      { error: "Signed-off audits cannot be deleted." },
      { status: 409 },
    );
  }

  // The audit_sessions table has SELECT/INSERT/UPDATE RLS policies but no
  // DELETE policy — a delete via the user's JWT silently no-ops (returns
  // 200 with zero affected rows). Now that ownership is verified above,
  // do the delete with the service-role admin client so it actually runs.
  // FK cascades on session_id then handle audit_findings, audit_trail,
  // audit_scoping_sessions, and audit_session_files.
  const admin = createAdminClient();

  // Pull the storage paths first so we can clean up the binaries after
  // the row delete cascades. Without this the bucket would accumulate
  // private 10MB objects forever — each deleted audit leaks up to 8 of
  // them per user. Best-effort: a storage failure shouldn't roll back
  // the row delete, just log it for the orphan reaper.
  const { data: fileRows } = await admin
    .from("audit_session_files")
    .select("storage_path")
    .eq("session_id", id);
  const storagePaths = (fileRows ?? [])
    .map((r) => (r as { storage_path: string }).storage_path)
    .filter((p): p is string => Boolean(p));

  const { count, error: deleteErr } = await admin
    .from("audit_sessions")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (deleteErr) {
    console.error("audit/sessions DELETE failed", { id, error: deleteErr.message });
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }
  if (!count) {
    console.error("audit/sessions DELETE affected 0 rows", { id, userId: user.id });
    return NextResponse.json(
      { error: "Audit could not be deleted." },
      { status: 500 },
    );
  }

  if (storagePaths.length > 0) {
    const { error: removeErr } = await admin.storage
      .from("audit-uploads")
      .remove(storagePaths);
    if (removeErr) {
      console.error("audit/sessions storage cleanup failed", {
        id,
        paths: storagePaths.length,
        error: removeErr.message,
      });
      // Intentionally don't fail the request — the row + cascades are gone.
    }
  }

  return NextResponse.json({ ok: true });
}
