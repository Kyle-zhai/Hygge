import { createHash } from "node:crypto";
import { supabase } from "../supabase.js";

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

interface AppendArgs {
  sessionId: string;
  action: string;
  actorId: string | null;
  payload: unknown;
}

export async function appendAuditTrail({ sessionId, action, actorId, payload }: AppendArgs): Promise<void> {
  const { data: session, error: sessionErr } = await supabase
    .from("audit_sessions")
    .select("audit_trail_head_hash")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr || !session) {
    throw new Error(`audit_trail.append: session lookup failed (${sessionErr?.message ?? "not found"})`);
  }

  const { data: lastRow } = await supabase
    .from("audit_trail")
    .select("seq")
    .eq("session_id", sessionId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = ((lastRow?.seq as number | undefined) ?? -1) + 1;

  const ts = new Date().toISOString();
  const payloadCanonical = canonicalJson(payload);
  const payloadHash = sha256Hex(payloadCanonical);
  const prevHash = session.audit_trail_head_hash ?? "";
  const thisHash = sha256Hex(`${prevHash}|${payloadHash}|${ts}`);

  const { error: insertErr } = await supabase.from("audit_trail").insert({
    session_id: sessionId,
    seq: nextSeq,
    action,
    actor_id: actorId,
    payload,
    payload_sha256: payloadHash,
    prev_hash: prevHash || null,
    this_hash: thisHash,
    ts,
  });
  if (insertErr) {
    throw new Error(`audit_trail.append: insert failed (${insertErr.message})`);
  }

  const { error: updateErr } = await supabase
    .from("audit_sessions")
    .update({ audit_trail_head_hash: thisHash })
    .eq("id", sessionId);
  if (updateErr) {
    throw new Error(`audit_trail.append: head hash update failed (${updateErr.message})`);
  }
}
