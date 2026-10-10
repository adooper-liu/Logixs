import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validatePackageArtifacts } from "./contracts.mjs";
import {
  canonicalStringify,
  canonicalText,
  packageHash,
  sha256Hex,
} from "./canonical-json.mjs";

function sortedRecords(records) {
  return [...records].sort((a, b) =>
    `${a.recordType}|${a.businessKey}`.localeCompare(
      `${b.recordType}|${b.businessKey}`,
    ),
  );
}
function sortedByCode(items) {
  return [...items].sort((a, b) =>
    `${a.code}|${a.recordRef ?? ""}`.localeCompare(
      `${b.code}|${b.recordRef ?? ""}`,
    ),
  );
}

export function buildPackageArtifacts(compileResult, context = {}) {
  const records = sortedRecords(compileResult.records ?? []);
  const gaps = sortedByCode(compileResult.gaps ?? []);
  const checks = sortedByCode(compileResult.checks ?? []);
  const sourceManifest = context.sourceManifest;
  const manifest = {
    manifestVersion: "full-chain-package.v1",
    source: sourceManifest
      ? {
          sourceAlias: sourceManifest.sourceAlias,
          manifestVersion: sourceManifest.manifestVersion,
          sourceSha256: sourceManifest.sha256,
          sizeBytes: sourceManifest.sizeBytes,
          workbookVersion: sourceManifest.workbookVersion,
          sheetCount: context.sheetCount ?? 0,
          lastModified: sourceManifest.lastModified ?? null,
        }
      : null,
    compilerVersion: context.compilerVersion ?? "full-chain-compiler.v1",
    mappingVersion: context.policy?.mappingVersion ?? "full-chain-mapping.v0.5",
    policyVersion: context.policy?.policyVersion ?? "full-chain-policy.v0.5",
    gitCommit: context.gitCommit ?? "not-provided",
    publishable: Boolean(compileResult.publishable),
    allowedProof: ["local diagnostic package only"],
    prohibitedProof: [
      "production truth",
      "business completion",
      "operating KPI",
    ],
    sensitiveDataHandling:
      "source values are excluded; lineage retains redacted references only",
    compiledAt: context.compiledAt ?? new Date().toISOString(),
    operator: context.operator ?? "compiler",
  };
  const artifacts = {
    manifest,
    records,
    lineage: [...(compileResult.lineage ?? [])].sort((a, b) =>
      `${a.recordRef}|${a.sourceRef}`.localeCompare(
        `${b.recordRef}|${b.sourceRef}`,
      ),
    ),
    gaps,
    checks,
  };
  manifest.recordCount = records.length;
  manifest.gapCount = gaps.length;
  manifest.checkCount = checks.length;
  manifest.recordsHash = sha256Hex(canonicalStringify(records));
  manifest.gapsHash = sha256Hex(canonicalStringify(gaps));
  manifest.checksHash = sha256Hex(canonicalStringify(checks));
  manifest.lineageCount = artifacts.lineage.length;
  manifest.lineageHash = sha256Hex(canonicalStringify(artifacts.lineage));
  manifest.packageHash = packageHash(artifacts);
  return { ...artifacts, manifest };
}

function reportHtml(artifacts) {
  const escaped = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return `<!doctype html><meta charset="utf-8"><title>Full-chain diagnostic package</title><h1>Diagnostic package</h1><p>publishable=${artifacts.manifest.publishable}</p><p>records=${artifacts.records.length} gaps=${artifacts.gaps.length} checks=${artifacts.checks.length}</p><ul>${[...artifacts.gaps, ...artifacts.checks].map((item) => `<li>${escaped(item.code)} ${escaped(item.status)}</li>`).join("")}</ul>\n`;
}

export async function writePackageAtomically({
  artifacts,
  outputDir,
  fsOps = {},
}) {
  const writeFile = fsOps.writeFile ?? fs.writeFile;
  const mkdir = fsOps.mkdir ?? fs.mkdir;
  const rename = fsOps.rename ?? fs.rename;
  try {
    await fs.access(outputDir);
    throw new Error("OUTPUT_EXISTS");
  } catch (error) {
    if (error.message === "OUTPUT_EXISTS") throw error;
  }
  const parent = path.dirname(outputDir);
  const staging = path.join(
    parent,
    `.${path.basename(outputDir)}.staging-${randomUUID()}`,
  );
  try {
    validatePackageArtifacts(artifacts);
    await mkdir(path.join(staging, "records"), { recursive: true });
    await writeFile(
      path.join(staging, "manifest.json"),
      canonicalText(artifacts.manifest),
    );
    for (const record of artifacts.records)
      await writeFile(
        path.join(staging, "records", `${record.recordType}.json`),
        canonicalText(
          artifacts.records.filter(
            (item) => item.recordType === record.recordType,
          ),
        ),
      );
    await writeFile(
      path.join(staging, "lineage.jsonl"),
      artifacts.lineage.map((item) => canonicalText(item)).join(""),
    );
    await writeFile(
      path.join(staging, "gaps.json"),
      canonicalText(artifacts.gaps),
    );
    await writeFile(
      path.join(staging, "checks.json"),
      canonicalText(artifacts.checks),
    );
    await writeFile(path.join(staging, "report.html"), reportHtml(artifacts));
    await writeFile(
      path.join(staging, "receipt.json"),
      canonicalText({
        receiptVersion: "v1",
        publishable: artifacts.manifest.publishable,
        packageHash: artifacts.manifest.packageHash,
      }),
    );
    await rename(staging, outputDir);
  } catch (error) {
    await fs
      .rm(staging, { recursive: true, force: true })
      .catch(() => undefined);
    if (error.message === "OUTPUT_EXISTS") throw error;
    throw new Error(`OUTPUT_PUBLISH_FAILED: ${error.message}`, {
      cause: error,
    });
  }
}
