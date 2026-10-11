import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validatePurgeManifest, validatePurgeReceipt } from "./contracts.mjs";
import { canonicalStringify } from "./canonical-json.mjs";

export async function writeManifestAtomically({
  manifest,
  outputDir,
  fsOps = {},
  validateStaging = async () => undefined,
}) {
  validatePurgeManifest(manifest);
  const fsx = { ...fs, ...fsOps };
  try {
    await fsx.access(outputDir);
    throw new Error("MANIFEST_OUTPUT_EXISTS");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const parent = path.dirname(outputDir);
  const staging = path.join(
    parent,
    `.${path.basename(outputDir)}.${randomUUID()}.staging`,
  );
  await fsx.mkdir(staging, { recursive: true });
  try {
    await fsx.writeFile(
      path.join(staging, "manifest.json"),
      `${canonicalStringify(manifest)}\n`,
      "utf8",
    );
    await fsx.writeFile(
      path.join(staging, "postgres.json"),
      `${canonicalStringify(manifest.postgres)}\n`,
      "utf8",
    );
    await fsx.writeFile(
      path.join(staging, "minio.json"),
      `${canonicalStringify(manifest.minio)}\n`,
      "utf8",
    );
    await fsx.writeFile(
      path.join(staging, "temporal.json"),
      `${canonicalStringify(manifest.temporal)}\n`,
      "utf8",
    );
    await fsx.writeFile(
      path.join(staging, "blockers.json"),
      `${canonicalStringify(manifest.blockers)}\n`,
      "utf8",
    );
    const receipt = validatePurgeReceipt({
      result: "manifest_generated",
      postgresCandidateCount: manifest.postgres.candidateCount,
      minioCandidateCount: manifest.minio.candidateCount,
      temporalTargetCount: manifest.temporal.candidateCount,
      blockerCount: manifest.blockers.count,
      manifestHash: manifest.manifestHash.slice(0, 12),
      traceId: manifest.traceId,
    });
    await fsx.writeFile(
      path.join(staging, "receipt.json"),
      `${canonicalStringify(receipt)}\n`,
      "utf8",
    );
    await validateStaging(staging);
    await fsx.rename(staging, outputDir);
    return receipt;
  } catch (error) {
    await fsx.rm(staging, { recursive: true, force: true });
    throw error;
  }
}
