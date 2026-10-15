import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FULL_CHAIN_COMPATIBILITY_V1,
  canonicalStringify,
  canonicalText,
  packageHash,
  readFullChainPackageDirectory,
  sha256Hex,
  validateFullChainPackageForLanding,
  validatePackageArtifacts,
  validateRehearsalReceipt,
} from "./index.mjs";

const SOURCE_HASH = "a".repeat(64);

function source(sheet, row) {
  return {
    sheet,
    row,
    sourceRef: `${sheet}:${row}`,
    originalValueHash: "b".repeat(64),
  };
}

function record(recordType, businessKey, payload, row) {
  return {
    recordType,
    recordVersion: "v1",
    businessKey,
    sampleLine: "TEST_CHAIN",
    evidenceClass: "R",
    source: source(`sheet-${recordType}`, row),
    derivation: null,
    scenario: null,
    payload,
  };
}

function fixtureRecords() {
  return [
    record(
      "shipment_plan",
      "PLAN-1",
      {
        planNo: "PLAN-1",
        containerRefs: ["CR-1"],
        bookingNo: "BOOK-1",
      },
      1,
    ),
    record(
      "booking_commitment",
      "BOOK-1",
      {
        bookingNo: "BOOK-1",
        masterBillNo: "MBL-1",
        houseBillRefs: ["HBL-1"],
        containerRefs: ["DISPLAY-GROUP-1"],
      },
      2,
    ),
    record(
      "cargo_ready_release",
      "CR-1",
      { cargoReadyNo: "CR-1", planNo: "DISPLAY-GROUP-1", quantity: "1.000" },
      3,
    ),
    record(
      "stuffing_snapshot_line",
      "CONT-1|CR-1|SKU-1|HBL-1",
      {
        containerNo: "CONT-1",
        cargoReadyNo: "CR-1",
        sku: "SKU-1",
        houseBillNo: "HBL-1",
        quantity: "1.000",
        quantityUnit: "piece",
        grossWeight: "2.000",
        volume: "3.000",
      },
      4,
    ),
    record(
      "export_customs_case",
      "INV-1",
      {
        invoiceNo: "INV-1",
        houseBillNo: "HBL-1",
        declarationNo: "DECL-1",
        amount: "4.00",
        currency: "USD",
      },
      5,
    ),
    record(
      "dispatch_fact",
      "CONT-1",
      {
        containerNo: "CONT-1",
        vesselName: "VESSEL ONE",
        voyageNo: "VOY-1",
        masterBillNo: "MBL-1",
        houseBillRefs: ["HBL-1"],
        gateInDate: "2026-09-17",
        departedAt: "2026-09-18",
        departedPrecision: "date",
        motherVesselDepartedAt: "2026-09-18",
      },
      6,
    ),
  ];
}

function rehash(artifacts) {
  const records = artifacts.records;
  const gaps = artifacts.gaps ?? [];
  const checks = artifacts.checks ?? [];
  const lineage = artifacts.lineage ?? [];
  Object.assign(artifacts.manifest, {
    recordCount: records.length,
    gapCount: gaps.length,
    checkCount: checks.length,
    lineageCount: lineage.length,
    recordsHash: sha256Hex(canonicalStringify(records)),
    gapsHash: sha256Hex(canonicalStringify(gaps)),
    checksHash: sha256Hex(canonicalStringify(checks)),
    lineageHash: sha256Hex(canonicalStringify(lineage)),
  });
  artifacts.manifest.packageHash = packageHash(artifacts);
  return artifacts;
}

function validArtifacts() {
  const records = fixtureRecords().sort((left, right) =>
    Buffer.from(`${left.recordType}|${left.businessKey}`).compare(
      Buffer.from(`${right.recordType}|${right.businessKey}`),
    ),
  );
  return rehash({
    manifest: {
      manifestVersion: "full-chain-package.v1",
      source: {
        manifestVersion: "full-chain-source-manifest.v1",
        sourceAlias: "controlled-sample",
        sourceSha256: SOURCE_HASH,
        sizeBytes: 1,
        workbookVersion: "v0.5.1",
        sheetCount: 33,
        lastModified: null,
      },
      compilerVersion: "full-chain-compiler.v1",
      mappingVersion: "full-chain-mapping.v0.5",
      policyVersion: "full-chain-policy.v0.5",
      gitCommit: "0123456789abcdef0123456789abcdef01234567",
      packageHash: "0".repeat(64),
      recordCount: 0,
      gapCount: 0,
      checkCount: 0,
      recordsHash: "0".repeat(64),
      gapsHash: "0".repeat(64),
      checksHash: "0".repeat(64),
      lineageCount: 0,
      lineageHash: "0".repeat(64),
      publishable: true,
      allowedProof: ["local diagnostic package only"],
      prohibitedProof: ["production truth"],
      sensitiveDataHandling: "redacted references only",
    },
    records,
    lineage: records.map((item) => ({
      recordRef: `${item.recordType}:${item.businessKey}`,
      sourceRef: item.source.sourceRef,
      payloadFields: Object.keys(item.payload),
    })),
    gaps: [],
    checks: [],
  });
}

async function writePackageDirectory(root, artifacts = validArtifacts()) {
  const packagePath = path.join(root, "package");
  await mkdir(path.join(packagePath, "records"), { recursive: true });
  await writeFile(
    path.join(packagePath, "manifest.json"),
    canonicalText(artifacts.manifest),
  );
  for (const recordType of [
    "shipment_plan",
    "booking_commitment",
    "cargo_ready_release",
    "stuffing_snapshot_line",
    "export_customs_case",
    "dispatch_fact",
  ]) {
    await writeFile(
      path.join(packagePath, "records", `${recordType}.json`),
      canonicalText(
        artifacts.records.filter((record) => record.recordType === recordType),
      ),
    );
  }
  await writeFile(
    path.join(packagePath, "lineage.jsonl"),
    artifacts.lineage.map((item) => canonicalText(item)).join(""),
  );
  await writeFile(
    path.join(packagePath, "gaps.json"),
    canonicalText(artifacts.gaps),
  );
  await writeFile(
    path.join(packagePath, "checks.json"),
    canonicalText(artifacts.checks),
  );
  await writeFile(path.join(packagePath, "report.html"), "<!doctype html>\n");
  await writeFile(
    path.join(packagePath, "receipt.json"),
    canonicalText({ receiptVersion: "v1", publishable: true }),
  );
  return packagePath;
}

async function withExternalPackage(action, artifacts = validArtifacts()) {
  const root = await mkdtemp(path.join(tmpdir(), "full-chain-contract-"));
  try {
    const packagePath = await writePackageDirectory(root, artifacts);
    return await action({ root, packagePath });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("exports the exact v1 landing compatibility matrix", () => {
  assert.deepEqual(FULL_CHAIN_COMPATIBILITY_V1, {
    manifestVersion: "full-chain-package.v1",
    sourceManifestVersion: "full-chain-source-manifest.v1",
    workbookVersion: "v0.5.1",
    compilerVersion: "full-chain-compiler.v1",
    mappingVersion: "full-chain-mapping.v0.5",
    policyVersion: "full-chain-policy.v0.5",
    recordVersion: "v1",
  });
});

for (const [field, wrong] of [
  ["manifestVersion", "full-chain-package.v2"],
  ["compilerVersion", "full-chain-compiler.v2"],
  ["mappingVersion", "full-chain-mapping.v0.6"],
  ["policyVersion", "full-chain-policy.v0.6"],
]) {
  test(`rejects unsupported ${field}`, () => {
    const artifacts = validArtifacts();
    artifacts.manifest[field] = wrong;
    assert.throws(
      () => validateFullChainPackageForLanding(rehash(artifacts)),
      /PACKAGE_VERSION_UNSUPPORTED/,
    );
  });
}

test("rejects an unsupported workbook version", () => {
  const artifacts = validArtifacts();
  artifacts.manifest.source.workbookVersion = "v0.6";
  assert.throws(
    () => validateFullChainPackageForLanding(rehash(artifacts)),
    /PACKAGE_VERSION_UNSUPPORTED/,
  );
});

test("rejects a package without a commit SHA provenance", () => {
  const artifacts = validArtifacts();
  artifacts.manifest.gitCommit = "not-provided";
  assert.throws(
    () => validateFullChainPackageForLanding(rehash(artifacts)),
    /PACKAGE_GIT_COMMIT_INVALID/,
  );
});

test("producer validation keeps the existing envelope-plus-allowlist contract", () => {
  const artifacts = validArtifacts();
  const shipment = artifacts.records.find(
    ({ recordType }) => recordType === "shipment_plan",
  );
  shipment.payload = { planNo: "PLAN-1" };
  assert.doesNotThrow(() => validatePackageArtifacts(rehash(artifacts)));
  assert.throws(
    () => validateFullChainPackageForLanding(rehash(artifacts)),
    /PACKAGE_RECORD_INVALID/,
  );
});

test("rejects a stuffing record missing the exact HBL", () => {
  const artifacts = validArtifacts();
  delete artifacts.records.find(
    ({ recordType }) => recordType === "stuffing_snapshot_line",
  ).payload.houseBillNo;
  assert.throws(
    () => validateFullChainPackageForLanding(rehash(artifacts)),
    /PACKAGE_RECORD_INVALID/,
  );
});

test("accepts a legacy stuffing record without a quantity unit but rejects invented units", () => {
  const legacy = validArtifacts();
  delete legacy.records.find(
    ({ recordType }) => recordType === "stuffing_snapshot_line",
  ).payload.quantityUnit;
  assert.doesNotThrow(() =>
    validateFullChainPackageForLanding(rehash(legacy)),
  );

  const unknown = validArtifacts();
  unknown.records.find(
    ({ recordType }) => recordType === "stuffing_snapshot_line",
  ).payload.quantityUnit = "unknown";
  assert.throws(
    () => validateFullChainPackageForLanding(rehash(unknown)),
    /PACKAGE_RECORD_INVALID/,
  );
});

test("accepts one strict record of each supported type", () => {
  const artifacts = validArtifacts();
  assert.equal(validateFullChainPackageForLanding(artifacts), artifacts);
});

test("validates only the redacted rehearsal receipt shape", () => {
  const receipt = {
    receiptVersion: "full-chain-rehearsal-receipt.v1",
    runId: "00000000-0000-4000-8000-000000000001",
    packageId: "a".repeat(16),
    tenantRef: "b".repeat(16),
    state: "staged",
    counts: { shipment_plan: 1 },
    gapCounts: { informational: 0 },
    reconciliationDigest: "c".repeat(64),
    createdAt: "2026-10-13T00:00:00.000Z",
  };
  assert.equal(validateRehearsalReceipt(receipt), receipt);
  assert.throws(
    () => validateRehearsalReceipt({ ...receipt, sourcePath: "C:/private" }),
    /REHEARSAL_RECEIPT_INVALID/,
  );
});

test("reads a package whose global record order differs from file type order", async () => {
  const artifacts = validArtifacts();
  artifacts.records.push(
    record(
      "booking_commitment",
      "BOOK-0",
      {
        bookingNo: "BOOK-0",
        masterBillNo: "MBL-0",
        houseBillRefs: ["HBL-0"],
        containerRefs: ["DISPLAY-GROUP-0"],
      },
      7,
    ),
  );
  artifacts.lineage.push({
    recordRef: "booking_commitment:BOOK-0",
    sourceRef: "sheet-booking_commitment:7",
    payloadFields: [
      "bookingNo",
      "masterBillNo",
      "houseBillRefs",
      "containerRefs",
    ],
  });
  artifacts.records.sort((left, right) =>
    Buffer.from(`${left.recordType}|${left.businessKey}`).compare(
      Buffer.from(`${right.recordType}|${right.businessKey}`),
    ),
  );
  rehash(artifacts);

  await withExternalPackage(async ({ root, packagePath }) => {
    const read = await readFullChainPackageDirectory({
      packagePath,
      approvedRoot: root,
      repositoryRoot: process.cwd(),
    });
    assert.equal(read.records.length, 7);
  }, artifacts);
});

test("reads one exact external package directory", async () => {
  await withExternalPackage(async ({ root, packagePath }) => {
    const artifacts = await readFullChainPackageDirectory({
      packagePath,
      approvedRoot: root,
      repositoryRoot: process.cwd(),
    });
    assert.equal(artifacts.records.length, 6);
  });
});

test("rejects a package inside the repository", async () => {
  const repositoryRoot = process.cwd();
  const packagePath = await mkdtemp(
    path.join(repositoryRoot, "contract-package-boundary-"),
  );
  try {
    await assert.rejects(
      readFullChainPackageDirectory({
        packagePath,
        approvedRoot: repositoryRoot,
        repositoryRoot,
      }),
      /PACKAGE_PATH_INVALID/,
    );
  } finally {
    await rm(packagePath, { recursive: true, force: true });
  }
});

test("rejects a package with a missing record file", async () => {
  await withExternalPackage(async ({ root, packagePath }) => {
    await unlink(path.join(packagePath, "records", "dispatch_fact.json"));
    await assert.rejects(
      readFullChainPackageDirectory({
        packagePath,
        approvedRoot: root,
        repositoryRoot: process.cwd(),
      }),
      /PACKAGE_FILE_SET_INVALID/,
    );
  });
});

test("rejects a package with an extra record file", async () => {
  await withExternalPackage(async ({ root, packagePath }) => {
    await writeFile(path.join(packagePath, "records", "unknown.json"), "[]\n");
    await assert.rejects(
      readFullChainPackageDirectory({
        packagePath,
        approvedRoot: root,
        repositoryRoot: process.cwd(),
      }),
      /PACKAGE_FILE_SET_INVALID/,
    );
  });
});

test("rejects malformed lineage JSONL", async () => {
  await withExternalPackage(async ({ root, packagePath }) => {
    await writeFile(path.join(packagePath, "lineage.jsonl"), "{not-json}\n");
    await assert.rejects(
      readFullChainPackageDirectory({
        packagePath,
        approvedRoot: root,
        repositoryRoot: process.cwd(),
      }),
      /PACKAGE_LINEAGE_INVALID/,
    );
  });
});

test("rejects a symlink or junction inside the package", async (context) => {
  await withExternalPackage(async ({ root, packagePath }) => {
    const recordsPath = path.join(packagePath, "records");
    const externalRecords = path.join(root, "external-records");
    await mkdir(externalRecords);
    for (const recordType of [
      "shipment_plan",
      "booking_commitment",
      "cargo_ready_release",
      "stuffing_snapshot_line",
      "export_customs_case",
      "dispatch_fact",
    ]) {
      await writeFile(
        path.join(externalRecords, `${recordType}.json`),
        canonicalText([]),
      );
    }
    await rm(recordsPath, { recursive: true });
    try {
      await symlink(
        externalRecords,
        recordsPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (error.code === "EPERM") {
        context.skip("Filesystem does not permit symlink or junction creation");
        return;
      }
      throw error;
    }
    await assert.rejects(
      readFullChainPackageDirectory({
        packagePath,
        approvedRoot: root,
        repositoryRoot: process.cwd(),
      }),
      /PACKAGE_PATH_INVALID/,
    );
  });
});
