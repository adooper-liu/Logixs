import {
  canonicalStringify,
  packageHash,
  sha256Hex,
  type FullChainCanonicalRecord,
  type ValidatedFullChainPackage,
} from "@logix/full-chain-sample-contracts";

const SOURCE_HASH = "a".repeat(64);
const VALUE_HASH = "b".repeat(64);

function source(sheet: string, row: number) {
  return {
    sheet,
    row,
    sourceRef: `${sheet}#${row}`,
    originalValueHash: VALUE_HASH,
  };
}

function record<T extends FullChainCanonicalRecord>(value: T): T {
  return value;
}

export function createValidFullChainPackage(): ValidatedFullChainPackage {
  const records: FullChainCanonicalRecord[] = [
    record({
      recordType: "shipment_plan",
      recordVersion: "v1",
      businessKey: "PLAN-1",
      sampleLine: "TEST_CHAIN",
      evidenceClass: "R",
      source: source("09_出运计划", 1),
      derivation: null,
      scenario: null,
      payload: {
        planNo: "PLAN-1",
        containerRefs: ["CR-1"],
        bookingNo: "BOOK-1",
      },
    }),
    record({
      recordType: "booking_commitment",
      recordVersion: "v1",
      businessKey: "BOOK-1",
      sampleLine: "TEST_CHAIN",
      evidenceClass: "R",
      source: source("09a_订舱", 2),
      derivation: null,
      scenario: null,
      payload: {
        bookingNo: "BOOK-1",
        masterBillNo: "MBL-1",
        houseBillRefs: ["HBL-1"],
        containerRefs: ["DISPLAY-GROUP-1"],
      },
    }),
    record({
      recordType: "cargo_ready_release",
      recordVersion: "v1",
      businessKey: "CR-1",
      sampleLine: "TEST_CHAIN",
      evidenceClass: "R",
      source: source("10_备货", 3),
      derivation: null,
      scenario: null,
      payload: {
        cargoReadyNo: "CR-1",
        planNo: "DISPLAY-GROUP-1",
        quantity: "1.000",
      },
    }),
    record({
      recordType: "stuffing_snapshot_line",
      recordVersion: "v1",
      businessKey: "CONT-1|CR-1|SKU-1|HBL-1",
      sampleLine: "TEST_CHAIN",
      evidenceClass: "R",
      source: source("11_装箱", 4),
      derivation: null,
      scenario: null,
      payload: {
        containerNo: "CONT-1",
        cargoReadyNo: "CR-1",
        sku: "SKU-1",
        houseBillNo: "HBL-1",
        quantity: "9007199254740993.000",
        grossWeight: "2.000",
        volume: "3.000",
      },
    }),
    record({
      recordType: "export_customs_case",
      recordVersion: "v1",
      businessKey: "INV-1",
      sampleLine: "TEST_CHAIN",
      evidenceClass: "R",
      source: source("11a_出口报关", 5),
      derivation: null,
      scenario: null,
      payload: {
        invoiceNo: "INV-1",
        houseBillNo: "HBL-1",
        declarationNo: "DECL-1",
        amount: "4.00",
        currency: "USD",
      },
    }),
    record({
      recordType: "dispatch_fact",
      recordVersion: "v1",
      businessKey: "CONT-1",
      sampleLine: "TEST_CHAIN",
      evidenceClass: "R",
      source: source("12_出运", 6),
      derivation: null,
      scenario: null,
      payload: {
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
    }),
  ];
  const lineage = records.map((item) => ({
    recordRef: `${item.recordType}:${item.businessKey}`,
    sourceRef: item.source.sourceRef,
    payloadFields: Object.keys(item.payload).sort(),
  }));
  const artifacts = {
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
      recordCount: records.length,
      gapCount: 0,
      checkCount: 0,
      recordsHash: sha256Hex(canonicalStringify(records)),
      gapsHash: sha256Hex(canonicalStringify([])),
      checksHash: sha256Hex(canonicalStringify([])),
      lineageCount: lineage.length,
      lineageHash: sha256Hex(canonicalStringify(lineage)),
      publishable: true,
      allowedProof: ["local diagnostic package only"],
      prohibitedProof: ["production truth"],
      sensitiveDataHandling: "redacted references only",
    },
    records,
    lineage,
    gaps: [],
    checks: [],
  } as ValidatedFullChainPackage;
  artifacts.manifest.packageHash = packageHash(artifacts);
  return artifacts;
}

export function mutateRecord(
  packageArtifacts: ValidatedFullChainPackage,
  recordType: FullChainCanonicalRecord["recordType"],
  mutate: (record: FullChainCanonicalRecord) => void,
): ValidatedFullChainPackage {
  const cloned = structuredClone(packageArtifacts);
  const target = cloned.records.find((item) => item.recordType === recordType);
  if (!target) throw new Error("TEST_RECORD_NOT_FOUND");
  mutate(target);
  return cloned;
}
