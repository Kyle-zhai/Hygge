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
  session_id?: string;
  seq: number;
  action: string;
  actor_id: string | null;
  payload?: Record<string, unknown>;
  payload_sha256: string;
  prev_hash: string | null;
  this_hash: string;
  ts: string;
}

// Postgres stores `this_hash` over `to_char(p_ts at time zone 'UTC',
// 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`. Roundtripping through the JS supabase
// client may return ts as `+00:00` form, so canonicalize via toISOString
// before recomputing.
function canonicalTs(ts: string): string {
  return new Date(ts).toISOString();
}

/**
 * Append a hash-chained row via the atomic SECURITY DEFINER RPC. The RPC holds
 * a FOR UPDATE lock on audit_sessions while computing the next seq and head
 * hash, eliminating the TOCTOU race the previous direct-insert path had.
 * See supabase/migrations/046_audit_trail_atomic_append.sql.
 *
 * Caller must pass a service-role client (createAdminClient()).
 */
export async function appendAuditTrail(
  client: SupabaseClient,
  args: {
    sessionId: string;
    action: string;
    actorId: string | null;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const { sessionId, action, actorId, payload } = args;
  const ts = new Date().toISOString();
  const payloadHash = sha256Hex(canonicalJson(payload));
  const { error } = await client.rpc("audit_trail_append", {
    p_session_id: sessionId,
    p_action: action,
    p_actor_id: actorId,
    p_payload: payload,
    p_payload_sha256: payloadHash,
    p_ts: ts,
  });
  if (error) {
    throw new Error(`audit_trail.append: rpc failed (${error.message})`);
  }
}

/**
 * Verifies the hash chain end-to-end and returns the index of the first
 * invalid row, or null if the whole chain validates.
 *
 * When `opts.withPayload` is true (default) and a row carries `payload`, also
 * recomputes payload_sha256 to catch a tamper that edits payload but leaves
 * payload_sha256 stale. The public verifier reads rows without payload and
 * passes `{ withPayload: false }` — chain integrity still holds because
 * audit_trail rows are immutable at the trigger level.
 */
export function verifyChain(
  rows: TrailRow[],
  opts: { withPayload?: boolean } = {}
): number | null {
  const { withPayload = true } = opts;
  let prev: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.seq !== i) return i;
    if (row.prev_hash !== prev) return i;
    if (withPayload && row.payload !== undefined) {
      const recomputedPayloadHash = sha256Hex(canonicalJson(row.payload));
      if (recomputedPayloadHash !== row.payload_sha256) return i;
    }
    const tsCanon = canonicalTs(row.ts);
    const expected = sha256Hex((prev ?? "") + "|" + row.payload_sha256 + "|" + tsCanon);
    if (expected !== row.this_hash) return i;
    prev = row.this_hash;
  }
  return null;
}

export type VerifyVerdict = "pass" | "fail";

/**
 * Page-level decision for the public verifier: is this audit demonstrably
 * authentic? Combines chain-internal validity with the session-level head
 * hash check, so a partial-write or split-brain state ("rows exist but
 * head_hash is null", "head_hash recorded but rows missing") fails closed.
 */
export function decideVerdict(args: {
  rows: TrailRow[];
  headHash: string | null;
}): VerifyVerdict {
  const { rows, headHash } = args;
  if (rows.length === 0 || headHash === null) return "fail";
  const firstInvalid = verifyChain(rows, { withPayload: false });
  if (firstInvalid !== null) return "fail";
  const lastHash = rows[rows.length - 1].this_hash;
  if (lastHash !== headHash) return "fail";
  return "pass";
}
