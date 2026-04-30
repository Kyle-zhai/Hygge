import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

export interface TrailRow {
  session_id: string;
  seq: number;
  action: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  payload_sha256: string;
  prev_hash: string | null;
  this_hash: string;
  ts: string;
}

/**
 * Append a hash-chained row to audit_trail and update the session's
 * audit_trail_head_hash.
 *
 * Caller must use a service-role client (or a user client with the right RLS
 * to read audit_sessions and insert audit_trail). Audit_trail rows are
 * insert-only — UPDATE / DELETE are blocked at the trigger level.
 */
export async function appendAuditTrail(
  client: SupabaseClient,
  args: {
    sessionId: string;
    action: string;
    actorId: string | null;
    payload: Record<string, unknown>;
  }
): Promise<TrailRow> {
  const { sessionId, action, actorId, payload } = args;

  const { data: session, error: sessionErr } = await client
    .from("audit_sessions")
    .select("audit_trail_head_hash")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr || !session) {
    throw new Error(`audit_trail: session ${sessionId} not found (${sessionErr?.message ?? "missing"})`);
  }

  const { data: lastRow } = await client
    .from("audit_trail")
    .select("seq")
    .eq("session_id", sessionId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const seq = (lastRow?.seq ?? -1) + 1;

  const ts = new Date().toISOString();
  const payloadJson = canonicalJson(payload);
  const payloadHash = sha256Hex(payloadJson);
  const prevHash = session.audit_trail_head_hash;
  const thisHash = sha256Hex((prevHash ?? "") + "|" + payloadHash + "|" + ts);

  const row: TrailRow = {
    session_id: sessionId,
    seq,
    action,
    actor_id: actorId,
    payload,
    payload_sha256: payloadHash,
    prev_hash: prevHash,
    this_hash: thisHash,
    ts,
  };

  const { error: insertErr } = await client.from("audit_trail").insert(row);
  if (insertErr) {
    throw new Error(`audit_trail insert failed: ${insertErr.message}`);
  }

  const { error: updateErr } = await client
    .from("audit_sessions")
    .update({ audit_trail_head_hash: thisHash })
    .eq("id", sessionId);
  if (updateErr) {
    throw new Error(`audit_sessions head_hash update failed: ${updateErr.message}`);
  }

  return row;
}

// Verifies the hash chain end-to-end — including recomputing payload_sha256 from
// the payload itself, so that an offline tamper that edits payload but leaves
// payload_sha256 unchanged is still detected. Returns first invalid index, or
// null if the whole chain validates.
export function verifyChain(rows: TrailRow[]): number | null {
  let prev: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.seq !== i) return i;
    if (row.prev_hash !== prev) return i;
    const recomputedPayloadHash = sha256Hex(canonicalJson(row.payload));
    if (recomputedPayloadHash !== row.payload_sha256) return i;
    const expected = sha256Hex((prev ?? "") + "|" + row.payload_sha256 + "|" + row.ts);
    if (expected !== row.this_hash) return i;
    prev = row.this_hash;
  }
  return null;
}
