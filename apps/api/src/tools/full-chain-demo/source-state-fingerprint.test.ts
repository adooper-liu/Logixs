import { describe, expect, it } from "vitest";
import { sourceStateFingerprint } from "./source-state-fingerprint";

describe("three-domain source fingerprint", () => {
  it("is order-independent and changes when MinIO source state changes", () => {
    const first = sourceStateFingerprint({
      postgres: { entries: [{ id: "b" }, { id: "a" }] },
      fingerprints: { schema: "schema", migration: "migration" },
      minio: { entries: [{ key: "two" }, { key: "one" }] },
      temporal: { entries: [{ id: "wf-b" }, { id: "wf-a" }] },
    });
    const reordered = sourceStateFingerprint({
      temporal: { entries: [{ id: "wf-a" }, { id: "wf-b" }] },
      minio: { entries: [{ key: "one" }, { key: "two" }] },
      fingerprints: { migration: "migration", schema: "schema" },
      postgres: { entries: [{ id: "a" }, { id: "b" }] },
    });
    const changed = sourceStateFingerprint({
      postgres: { entries: [{ id: "a" }, { id: "b" }] },
      fingerprints: { schema: "schema", migration: "migration" },
      minio: { entries: [{ key: "one" }, { key: "changed" }] },
      temporal: { entries: [{ id: "wf-a" }, { id: "wf-b" }] },
    });

    expect(first).toBe(reordered);
    expect(first).not.toBe(changed);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
  });
});
