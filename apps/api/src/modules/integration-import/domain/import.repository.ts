import type {
  ImportBatch,
  ImportMappingSuggestion,
  ImportReview,
  ImportRow,
  NewImportRow,
} from "./import-batch";
import type {
  PostDepartureSourceBatchV1,
  PostDepartureSourcePackagePreflightResultV1,
} from "@logix/contracts";

// 导入持久化端口（Port/Adapter）：Application 依赖此抽象，Infrastructure 用 Prisma 实现。
export const IMPORT_REPOSITORY = Symbol("ImportRepository");

export interface NewImportBatch {
  id: string;
  tenantId: string;
  operatorId: string;
  idempotencyKey: string;
  fileName: string;
  fileHash: string;
  sourceFileStatus: "retained";
  sourceObjectKey: string;
  sourceContentType: string;
  sourceSizeBytes: number;
  sourceRetainedAt: Date;
  parserVersion: string;
  replacesBatchId: string | null;
  status: ImportBatch["status"];
  rowCount: number;
  columnCount: number;
  mappingSuggestions: ImportMappingSuggestion[];
}

export interface ImportBatchWithRows {
  batch: ImportBatch;
  rows: ImportRow[];
  reviews: ImportReview[];
}

// 阶段 C：映射审核（人确认/修正列→字段）。
export interface ImportReviewInput {
  column: string;
  fieldCode: string | null;
  operatorId: string;
}

// 阶段 C：逐行落账结果。
export interface ImportRowResultInput {
  rowId: string;
  outcome: "success" | "failed" | "duplicate";
  containerRecordId: string | null;
  detail: string | null;
}

export type PostDepartureSourcePackageReviewSnapshot = Omit<
  PostDepartureSourcePackagePreflightResultV1,
  "traceId"
>;

export interface PostDepartureSourcePackageReviewRecord {
  id: string;
  tenantId: string;
  packageHash: string;
  contractVersion: "post-departure-source-package-review.v1";
  decision: "review_required";
  candidateCount: number;
  reviewRequiredCount: number;
  snapshot: PostDepartureSourcePackageReviewSnapshot;
  snapshotHash: string;
  operatorId: string;
  traceId: string;
  createdAt: Date;
}

export interface NewPostDepartureSourcePackageReview extends Omit<
  PostDepartureSourcePackageReviewRecord,
  "createdAt"
> {
  sources: PostDepartureSourceBatchV1[];
}

export interface SavePostDepartureSourcePackageReviewResult {
  created: boolean;
  review: PostDepartureSourcePackageReviewRecord;
}

export interface PostDepartureSourceCandidateCorrectionRecord {
  id: string;
  tenantId: string;
  reviewId: string;
  candidateRef: string;
  version: number;
  supersedesCorrectionId: string | null;
  shipmentGroupingKind:
    | "authorized_new_shipment"
    | "existing_shipment"
    | "new_independent_shipment"
    | null;
  shipmentNumber: string | null;
  targetShipmentId: string | null;
  targetRelationshipVersion: number | null;
  originPortId: string | null;
  originUnlocode: string | null;
  destinationPortId: string | null;
  destinationUnlocode: string | null;
  departureLocal: string | null;
  departureOccurredAt: Date | null;
  departureSourceTimezone: string | null;
  departureEvidenceId: string | null;
  operatorId: string;
  reasonCode: string;
  idempotencyKey: string;
  payloadHash: string;
  createdAt: Date;
  cargoLines: PostDepartureSourceCandidateCargoLineRecord[];
}

export interface PostDepartureSourceCandidateCargoLineRecord {
  id: string;
  lineNumber: number;
  sourceLineId: string;
  replenishmentOrderNumber: string;
  productSkuId: string;
  productNumber: string;
  quantity: string;
  quantityUnit: "piece" | "carton" | "set" | "pallet";
  replenishmentOrderLineId: string | null;
}

export interface NewPostDepartureSourceCandidateCargoLine {
  id: string;
  lineNumber: number;
  sourceLineId: string;
  replenishmentOrderNumber: string;
  productSkuId: string;
  productNumber: string;
  quantity: string;
  quantityUnit: "piece" | "carton" | "set" | "pallet";
  replenishmentOrderLineId: string | null;
}

export interface NewPostDepartureSourceCandidateCorrection extends Omit<
  PostDepartureSourceCandidateCorrectionRecord,
  "id" | "version" | "supersedesCorrectionId" | "createdAt" | "cargoLines"
> {
  id: string;
  expectedVersion: number;
  cargoLines?: NewPostDepartureSourceCandidateCargoLine[];
}

export interface SavePostDepartureSourceCandidateCorrectionResult {
  created: boolean;
  correction: PostDepartureSourceCandidateCorrectionRecord;
}

export class PostDepartureCorrectionIdempotencyConflictError extends Error {
  constructor() {
    super("POST_DEPARTURE_CORRECTION_IDEMPOTENCY_CONFLICT");
  }
}

export class PostDepartureCorrectionVersionConflictError extends Error {
  constructor() {
    super("POST_DEPARTURE_CORRECTION_VERSION_CONFLICT");
  }
}

export interface ImportRepository {
  findByIdempotencyKey(
    tenantId: string,
    key: string,
  ): Promise<ImportBatch | null>;
  findById(id: string, tenantId: string): Promise<ImportBatchWithRows | null>;
  create(input: NewImportBatch, rows: NewImportRow[]): Promise<ImportBatch>;
  saveReviewDecision(
    batchId: string,
    confirmedQuantityUnit: string | null,
    reviews: ImportReviewInput[],
  ): Promise<void>;
  updateStatus(batchId: string, status: string): Promise<void>;
  saveRowResults(
    batchId: string,
    results: ImportRowResultInput[],
  ): Promise<void>;
  getRowResults(batchId: string): Promise<ImportRowResultInput[]>;
  savePostDepartureSourcePackageReview(
    input: NewPostDepartureSourcePackageReview,
  ): Promise<SavePostDepartureSourcePackageReviewResult>;
  findPostDepartureSourcePackageReviewById(
    reviewId: string,
    tenantId: string,
  ): Promise<PostDepartureSourcePackageReviewRecord | null>;
  findPostDepartureSourcePackageReviewByPackage(
    tenantId: string,
    packageHash: string,
  ): Promise<PostDepartureSourcePackageReviewRecord | null>;
  listLatestPostDepartureSourceCandidateCorrections(
    reviewId: string,
    tenantId: string,
  ): Promise<PostDepartureSourceCandidateCorrectionRecord[]>;
  savePostDepartureSourceCandidateCorrection(
    input: NewPostDepartureSourceCandidateCorrection,
  ): Promise<SavePostDepartureSourceCandidateCorrectionResult>;
}
