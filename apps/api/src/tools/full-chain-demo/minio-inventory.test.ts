import { describe, expect, it, vi } from "vitest";
import {
  assertEmptyRehearsalPrefix,
  buildRehearsalObjectKey,
} from "./external-adapters";
import { collectMinioInventory } from "./minio-inventory";

describe("MinIO ownership inventory", () => {
  it("requires DB ownership and detects missing objects", async () => {
    const result = await collectMinioInventory({
      targetTenant: "demo-real-sample-20260921",
      batches: [
        {
          tenantId: "demo-real-sample-20260921",
          sourceObjectKey: "owned",
          fileSha256: "a",
        },
      ],
      client: { listObjects: async () => [], headObject: async () => null },
    });
    expect(result.blockers).toContain("MINIO_OBJECT_MISSING");
    expect(result.candidateCount).toBe(0);
  });

  it("blocks duplicate owners, checksum mismatch, and unowned objects", async () => {
    const result = await collectMinioInventory({
      targetTenant: "demo-real-sample-20260921",
      batches: [
        { tenantId: "demo-real-sample-20260921", sourceObjectKey: "duplicate" },
        { tenantId: "other", sourceObjectKey: "duplicate" },
        {
          tenantId: "demo-real-sample-20260921",
          sourceObjectKey: "mismatch",
          fileSha256: "expected",
        },
      ],
      client: {
        listObjects: async () => [{ key: "orphan" }],
        headObject: async (key) =>
          key === "mismatch" ? { key, checksum: "actual" } : { key },
      },
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "MINIO_OWNERSHIP_AMBIGUOUS",
        "MINIO_CHECKSUM_MISMATCH",
        "MINIO_ORPHAN_OBJECT",
      ]),
    );
  });

  it("rejects a non-empty rehearsal prefix before copying", async () => {
    await expect(
      assertEmptyRehearsalPrefix("rehearsal/shared", async () => [
        "rehearsal/shared/existing",
      ]),
    ).rejects.toThrow("BACKUP_TARGET_NOT_ISOLATED");
    await expect(
      assertEmptyRehearsalPrefix("rehearsal/new", async () => []),
    ).resolves.toBeUndefined();
  });

  it("joins only rehearsal-owned relative object keys before any storage call", () => {
    const send = vi.fn();
    expect(
      buildRehearsalObjectKey("rehearsal/run-1/", "imports/source.xlsx"),
    ).toBe("rehearsal/run-1/imports/source.xlsx");
    expect(send).not.toHaveBeenCalled();

    for (const [prefix, key] of [
      ["source", "imports/source.xlsx"],
      ["rehearsal/../escape", "imports/source.xlsx"],
      ["rehearsal/run-1", "/absolute"],
      ["rehearsal/run-1", "../escape"],
      ["rehearsal/run-1", "nested\\escape"],
    ]) {
      expect(() => buildRehearsalObjectKey(prefix, key)).toThrow(
        "RESTORE_TARGET_PREFIX_INVALID",
      );
    }
    expect(send).not.toHaveBeenCalled();
  });
});
