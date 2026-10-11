import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { digestObjectBody } from "./external-adapters";

describe("MinIO object byte digest", () => {
  it("computes SHA-256 and size across stream chunks", async () => {
    const chunks = [Buffer.from("same-"), Buffer.from("bytes")];
    const digest = await digestObjectBody(Readable.from(chunks));

    expect(digest).toEqual({
      size: 10,
      sha256: createHash("sha256").update("same-bytes").digest("hex"),
    });
  });

  it("fails closed when the object body is unavailable", async () => {
    await expect(digestObjectBody(undefined)).rejects.toThrow(
      "MINIO_CHECKSUM_MISMATCH",
    );
  });
});
