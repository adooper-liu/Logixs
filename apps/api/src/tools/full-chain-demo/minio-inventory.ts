import { createHash } from "node:crypto";

export type MinioObject = {
  key: string;
  size?: number;
  checksum?: string;
  metadataChecksum?: string | null;
};
export type MinioInventoryResult = {
  entries: Array<Record<string, unknown>>;
  blockers: string[];
  candidateCount: number;
};
type S3 = {
  listObjects: () => Promise<MinioObject[]>;
  headObject: (key: string) => Promise<MinioObject | null>;
};
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function collectMinioInventory(input: {
  client: S3;
  batches: Array<{
    tenantId: string;
    sourceObjectKey?: string;
    fileSha256?: string;
    fileSize?: number;
  }>;
  targetTenant: string;
}): Promise<MinioInventoryResult> {
  const blockers: string[] = [];
  const entries: Array<Record<string, unknown>> = [];
  const references = new Map<
    string,
    Array<{ tenantId: string; fileSha256?: string; fileSize?: number }>
  >();
  for (const batch of input.batches)
    if (batch.sourceObjectKey)
      references.set(batch.sourceObjectKey, [
        ...(references.get(batch.sourceObjectKey) ?? []),
        batch,
      ]);
  for (const [key, owners] of references) {
    if (owners.length !== 1) {
      blockers.push("MINIO_OWNERSHIP_AMBIGUOUS");
      continue;
    }
    const object = await input.client.headObject(key);
    if (!object) {
      blockers.push("MINIO_OBJECT_MISSING");
      continue;
    }
    const owner = owners[0];
    if (
      !owner.fileSha256 ||
      !object.checksum ||
      !/^[a-f0-9]{64}$/u.test(owner.fileSha256) ||
      owner.fileSha256.toLowerCase() !== object.checksum.toLowerCase()
    ) {
      blockers.push("MINIO_CHECKSUM_MISMATCH");
      continue;
    }
    if (
      owner.fileSize !== undefined &&
      object.size !== undefined &&
      owner.fileSize !== object.size
    ) {
      blockers.push("MINIO_CHECKSUM_MISMATCH");
      continue;
    }
    if (owner.tenantId === input.targetTenant)
      entries.push({
        key,
        size: object.size ?? null,
        checksum: object.checksum,
        metadataChecksum: object.metadataChecksum ?? null,
        ownership: "ImportBatch.sourceObjectKey",
      });
  }
  for (const object of await input.client.listObjects())
    if (!references.has(object.key)) blockers.push("MINIO_ORPHAN_OBJECT");
  return {
    entries,
    blockers: [...new Set(blockers)],
    candidateCount: entries.length,
  };
}
export function minioInventoryHash(result: MinioInventoryResult) {
  return digest(result.entries);
}
