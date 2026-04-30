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
  const ts = new Date().toISOString();
  const payloadCanonical = canonicalJson(payload);
  const payloadHash = sha256Hex(payloadCanonical);

  const { error } = await supabase.rpc("audit_trail_append", {
    p_session_id: sessionId,
    p_action: action,
    p_actor_id: actorId,
    p_payload: payload as never,
    p_payload_sha256: payloadHash,
    p_ts: ts,
  });
  if (error) {
    throw new Error(`audit_trail.append: rpc failed (${error.message})`);
  }
}
