import type {
  OceanOperationsReviewProjection,
  ArrivalPreparationResult,
  SourceReviewDecision,
  SourceReviewQueueItem,
} from "./ocean-operations-source-review";

export const OCEAN_OPERATIONS_SOURCE_REVIEW_REPOSITORY = Symbol(
  "OceanOperationsSourceReviewRepository",
);
export interface ListSourceReviewsInput {
  tenantId: string;
  containerNumber?: string;
}
export interface SaveSourceReviewInput {
  tenantId: string;
  actorId: string;
  containerId: string;
  sourceObservationId: string;
  reviewDecision: SourceReviewDecision;
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
  traceId: string;
  arrivalPreparationResult?: ArrivalPreparationResult;
  nextStep?: string;
  expectedArrivalPreparationVersion?: number;
}
export interface SavedSourceReview {
  recordState: "recorded" | "duplicate";
  review: NonNullable<OceanOperationsReviewProjection["review"]>;
  arrivalPreparation: OceanOperationsReviewProjection["arrivalPreparation"];
}
export interface OceanOperationsSourceReviewRepository {
  listQueue(input: ListSourceReviewsInput): Promise<SourceReviewQueueItem[]>;
  getProjection(
    tenantId: string,
    containerId: string,
  ): Promise<OceanOperationsReviewProjection>;
  save(input: SaveSourceReviewInput): Promise<SavedSourceReview>;
}
