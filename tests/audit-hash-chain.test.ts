import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex, verifyChain, type TrailRow } from "../src/lib/audit/hash-chain";

describe("canonicalJson", () => {
  it("sorts object keys recursively", () => {
    const a = { b: 1, a: { z: 1, y: 2 } };
    const b = { a: { y: 2, z: 1 }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("preserves array order (arrays are ordered, not sets)", () => {
    expect(canonicalJson([1, 2, 3])).toBe("[1,2,3]");
    expect(canonicalJson([3, 2, 1])).toBe("[3,2,1]");
  });

  it("handles nulls and primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(true)).toBe("true");
  });

  it("yields stable hash regardless of key insertion order", () => {
    const a = { foo: "bar", nested: { c: 3, a: 1, b: 2 } };
    const b = { nested: { a: 1, b: 2, c: 3 }, foo: "bar" };
    expect(sha256Hex(canonicalJson(a))).toBe(sha256Hex(canonicalJson(b)));
  });
});

function makeRow(
  seq: number,
  prevHash: string | null,
  payload: Record<string, unknown>,
  ts: string,
): TrailRow {
  const payloadHash = sha256Hex(canonicalJson(payload));
  const thisHash = sha256Hex((prevHash ?? "") + "|" + payloadHash + "|" + ts);
  return {
    session_id: "s1",
    seq,
    action: "x",
    actor_id: null,
    payload,
    payload_sha256: payloadHash,
    prev_hash: prevHash,
    this_hash: thisHash,
    ts,
  };
}

describe("verifyChain", () => {
  it("returns null for a valid chain", () => {
    const r0 = makeRow(0, null, { event: "created" }, "2026-01-01T00:00:00Z");
    const r1 = makeRow(1, r0.this_hash, { event: "updated" }, "2026-01-01T00:00:01Z");
    const r2 = makeRow(2, r1.this_hash, { event: "signed" }, "2026-01-01T00:00:02Z");
    expect(verifyChain([r0, r1, r2])).toBeNull();
  });

  it("rejects an empty chain as valid (no rows = nothing to verify)", () => {
    expect(verifyChain([])).toBeNull();
  });

  it("detects gap in seq numbering", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00Z");
    const r2 = makeRow(2, r0.this_hash, { event: "c" }, "2026-01-01T00:00:02Z");
    expect(verifyChain([r0, r2])).toBe(1);
  });

  it("detects tampered payload (payload_sha256 mismatch breaks this_hash)", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00Z");
    const tampered: TrailRow = { ...r0, payload: { event: "b" } };
    expect(verifyChain([tampered])).toBe(0);
  });

  it("detects tampered timestamp", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00Z");
    const tampered: TrailRow = { ...r0, ts: "2026-01-01T00:00:01Z" };
    expect(verifyChain([tampered])).toBe(0);
  });

  it("detects broken prev_hash linkage", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00Z");
    const r1 = makeRow(1, "deadbeef".repeat(8), { event: "b" }, "2026-01-01T00:00:01Z");
    expect(verifyChain([r0, r1])).toBe(1);
  });

  it("detects row reordering (forging by swap)", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00Z");
    const r1 = makeRow(1, r0.this_hash, { event: "b" }, "2026-01-01T00:00:01Z");
    expect(verifyChain([r1, r0])).toBe(0);
  });
});
