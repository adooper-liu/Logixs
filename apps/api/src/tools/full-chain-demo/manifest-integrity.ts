import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function validateBackupManifestIntegrity(input: {
  manifest: Record<string, unknown>;
  expectedHash: string;
  expectedSourceManifestHash: string;
  repositoryRoot: string;
}): Promise<void> {
  const { validateBackupManifest } = await import(
    pathToFileURL(
      path.join(input.repositoryRoot, "scripts/full-chain-demo/contracts.mjs"),
    ).href
  );
  const { canonicalStringify } = await import(
    pathToFileURL(
      path.join(
        input.repositoryRoot,
        "scripts/full-chain-demo/canonical-json.mjs",
      ),
    ).href
  );
  try {
    validateBackupManifest(input.manifest);
  } catch {
    throw new Error("MANIFEST_INVALID");
  }
  const projection = { ...input.manifest };
  delete projection.backupManifestHash;
  const actualHash = createHash("sha256")
    .update(canonicalStringify(projection), "utf8")
    .digest("hex");
  if (
    input.manifest.backupManifestHash !== input.expectedHash ||
    actualHash !== input.expectedHash
  )
    throw new Error("MANIFEST_HASH_MISMATCH");
  if (
    input.manifest.sourceManifestHash !== input.expectedSourceManifestHash ||
    input.manifest.verified !== true ||
    input.manifest.status !== "verified"
  )
    throw new Error("MANIFEST_INVALID");
}

export async function validatePurgeManifestIntegrity(input: {
  manifest: Record<string, unknown>;
  expectedHash: string;
  expectedTenant: string;
  expectedCatalogVersion: string;
  repositoryRoot: string;
}): Promise<void> {
  const { validatePurgeManifest } = await import(
    pathToFileURL(
      path.join(input.repositoryRoot, "scripts/full-chain-demo/contracts.mjs"),
    ).href
  );
  const { canonicalStringify, manifestHashProjection } = await import(
    pathToFileURL(
      path.join(
        input.repositoryRoot,
        "scripts/full-chain-demo/canonical-json.mjs",
      ),
    ).href
  );
  try {
    validatePurgeManifest(input.manifest);
  } catch {
    throw new Error("MANIFEST_INVALID");
  }
  const actualHash = createHash("sha256")
    .update(canonicalStringify(manifestHashProjection(input.manifest)), "utf8")
    .digest("hex");
  if (
    input.manifest.manifestHash !== input.expectedHash ||
    actualHash !== input.expectedHash
  )
    throw new Error("MANIFEST_HASH_MISMATCH");
  if (
    input.manifest.targetTenant !== input.expectedTenant ||
    input.manifest.catalogVersion !== input.expectedCatalogVersion ||
    input.manifest.deletable !== false
  )
    throw new Error("MANIFEST_INVALID");
}
