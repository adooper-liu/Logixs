export type FullChainRecordType =
  | "shipment_plan"
  | "booking_commitment"
  | "cargo_ready_release"
  | "stuffing_snapshot_line"
  | "export_customs_case"
  | "dispatch_fact";

export type FullChainEvidenceClass = "R" | "D" | "S";
export type FullChainRecord<T extends FullChainRecordType, P> = {
  recordType: T;
  recordVersion: "v1";
  businessKey: string;
  sampleLine: string;
  evidenceClass: FullChainEvidenceClass;
  source: {
    sheet: string;
    row: number;
    sourceRef: string;
    originalValueHash: string;
  };
  derivation: null | {
    code: string;
    version: string;
    inputRefs: string[];
    contributorRefs?: string[];
  };
  scenario: null | { label: string; allowedUse: "local_demo_rehearsal" };
  aggregation?: null | { code: "FC-D07"; contributorRefs: string[] };
  payload: P;
};

export type ShipmentPlanRecord = FullChainRecord<
  "shipment_plan",
  { planNo: string; containerRefs: string[]; bookingNo: string }
>;
export type BookingCommitmentRecord = FullChainRecord<
  "booking_commitment",
  {
    bookingNo: string;
    masterBillNo: string;
    houseBillRefs: string[];
    /** Display grouping only; never a cargo-ready or container relation. */
    containerRefs: string[];
  }
>;
export type CargoReadyReleaseRecord = FullChainRecord<
  "cargo_ready_release",
  {
    cargoReadyNo: string;
    /** Historical field name for the display-only main cargo-ready group. */
    planNo: string;
    sku?: string;
    quantity: string;
    quantityUnit?: string;
  }
>;
export type StuffingSnapshotLineRecord = FullChainRecord<
  "stuffing_snapshot_line",
  {
    containerNo: string;
    cargoReadyNo: string;
    sku: string;
    houseBillNo: string;
    quantity: string;
    quantityUnit?: "piece" | "set";
    grossWeight: string;
    volume: string;
  }
>;
export type ExportCustomsCaseRecord = FullChainRecord<
  "export_customs_case",
  {
    invoiceNo: string;
    houseBillNo: string;
    declarationNo: string;
    amount: string;
    currency: string;
  }
>;
export type DispatchFactRecord = FullChainRecord<
  "dispatch_fact",
  {
    containerNo: string;
    vesselName: string;
    voyageNo: string;
    masterBillNo: string;
    houseBillRefs: string[];
    gateInDate: string;
    departedAt: string;
    departedPrecision: "date";
    motherVesselDepartedAt: string;
  }
>;
export type FullChainCanonicalRecord =
  | ShipmentPlanRecord
  | BookingCommitmentRecord
  | CargoReadyReleaseRecord
  | StuffingSnapshotLineRecord
  | ExportCustomsCaseRecord
  | DispatchFactRecord;

export interface FullChainPackageArtifacts {
  manifest: Record<string, unknown> & {
    manifestVersion: string;
    packageHash: string;
    publishable: boolean;
  };
  records: FullChainCanonicalRecord[];
  lineage: Array<Record<string, unknown>>;
  gaps: Array<Record<string, unknown>>;
  checks: Array<Record<string, unknown>>;
}

export type ValidatedFullChainPackage = FullChainPackageArtifacts;
export interface FullChainRehearsalReceipt {
  receiptVersion: "full-chain-rehearsal-receipt.v1";
  runId: string;
  packageId: string;
  tenantRef: string;
  state: "staged";
  counts: Record<string, number>;
  gapCounts: Record<string, number>;
  reconciliationDigest: string;
  createdAt: string;
}

export const FULL_CHAIN_COMPATIBILITY_V1: Readonly<{
  manifestVersion: "full-chain-package.v1";
  sourceManifestVersion: "full-chain-source-manifest.v1";
  workbookVersion: "v0.5.1";
  compilerVersion: "full-chain-compiler.v1";
  mappingVersion: "full-chain-mapping.v0.5";
  policyVersion: "full-chain-policy.v0.5";
  recordVersion: "v1";
}>;
export function validatePackageArtifacts(
  artifacts: FullChainPackageArtifacts,
): void;
export function validateFullChainPackageForLanding(
  artifacts: FullChainPackageArtifacts,
): ValidatedFullChainPackage;
export function readFullChainPackageDirectory(input: {
  packagePath: string;
  approvedRoot: string;
  repositoryRoot: string;
}): Promise<FullChainPackageArtifacts>;
export function validateRehearsalReceipt(
  value: unknown,
): FullChainRehearsalReceipt;
export function canonicalStringify(value: unknown): string;
export function canonicalText(value: unknown): string;
export function compareCanonicalStrings(left: unknown, right: unknown): number;
export function sha256Hex(value: string | Buffer): string;
export function packageHashProjection(
  artifacts: FullChainPackageArtifacts,
): unknown;
export function packageHash(artifacts: FullChainPackageArtifacts): string;
