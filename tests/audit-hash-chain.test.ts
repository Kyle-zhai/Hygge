import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  decideVerdict,
  sha256Hex,
  verifyChain,
  type TrailRow,
} from "../src/lib/audit/hash-chain";

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
  // Canonicalize ts the same way Postgres + verifyChain do, so the hash this
  // helper computes matches what production stores after a Date roundtrip.
  const tsCanon = new Date(ts).toISOString();
  const payloadHash = sha256Hex(canonicalJson(payload));
  const thisHash = sha256Hex((prevHash ?? "") + "|" + payloadHash + "|" + tsCanon);
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

  it("accepts ts roundtripped through Postgres `+00:00` offset form", () => {
    // Supabase JS may return timestamptz as `2026-01-01T00:00:00+00:00`
    // instead of the `Z` form the worker computed. Canonicalization through
    // toISOString must produce the same hash.
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00.000Z");
    const tampered: TrailRow = { ...r0, ts: "2026-01-01T00:00:00.000+00:00" };
    expect(verifyChain([tampered])).toBeNull();
  });

  it("withPayload=false ignores missing payload (public verifier)", () => {
    // Public verifier reads only chain metadata, not payload contents.
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00.000Z");
    const r1 = makeRow(1, r0.this_hash, { event: "b" }, "2026-01-01T00:00:01.000Z");
    const stripped = [r0, r1].map(({ payload, ...rest }) => {
      void payload;
      return rest as TrailRow;
    });
    expect(verifyChain(stripped, { withPayload: false })).toBeNull();
  });

  it("withPayload=false still detects chain forgery", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00.000Z");
    const r1 = makeRow(1, "deadbeef".repeat(8), { event: "b" }, "2026-01-01T00:00:01.000Z");
    expect(verifyChain([r0, r1], { withPayload: false })).toBe(1);
  });

  it("ms-truncation invariant: a row whose stored ts retains sub-ms still verifies because both Postgres and JS truncate to ms", () => {
    // Documents the precision contract enforced by migration 048: the
    // canonical hash form is ms-precision (Postgres `to_char(...'MS')` and
    // JS `Date.toISOString()` both produce 3-digit ms). A pre-048 row with
    // microseconds in the ts column still verifies because canonicalTs
    // strips them on the verifier side. Migration 048 closes the storage
    // gap so DB tooling sees a consistent representation.
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00.000Z");
    const subMsRow: TrailRow = { ...r0, ts: "2026-01-01T00:00:00.000123Z" };
    expect(verifyChain([subMsRow])).toBeNull();
  });
});

describe("decideVerdict", () => {
  function chainOfTwo(): TrailRow[] {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00.000Z");
    const r1 = makeRow(1, r0.this_hash, { event: "b" }, "2026-01-01T00:00:01.000Z");
    return [r0, r1];
  }

  it("fails on empty rows", () => {
    expect(decideVerdict({ rows: [], headHash: "abc" })).toBe("fail");
  });

  it("fails on null head hash", () => {
    const rows = chainOfTwo();
    expect(decideVerdict({ rows, headHash: null })).toBe("fail");
  });

  it("passes when chain is valid and head matches last row", () => {
    const rows = chainOfTwo();
    const headHash = rows[rows.length - 1].this_hash;
    expect(decideVerdict({ rows, headHash })).toBe("pass");
  });

  it("fails on split-brain: head hash recorded but does not match last row", () => {
    const rows = chainOfTwo();
    expect(decideVerdict({ rows, headHash: "deadbeef".repeat(8) })).toBe("fail");
  });

  it("fails on broken chain even if head hash matches last row", () => {
    const r0 = makeRow(0, null, { event: "a" }, "2026-01-01T00:00:00.000Z");
    const forged = makeRow(1, "deadbeef".repeat(8), { event: "b" }, "2026-01-01T00:00:01.000Z");
    expect(decideVerdict({ rows: [r0, forged], headHash: forged.this_hash })).toBe("fail");
  });

  it("fails on tampered ts even if head hash matches last row", () => {
    const rows = chainOfTwo();
    const tampered: TrailRow = { ...rows[1], ts: "2099-12-31T00:00:00.000Z" };
    expect(decideVerdict({
      rows: [rows[0], tampered],
      headHash: tampered.this_hash,
    })).toBe("fail");
  });
});
