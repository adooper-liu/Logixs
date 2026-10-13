import type { FullChainLandingGraph } from "./landing-graph";

export const FULL_CHAIN_LANDING_REPOSITORY = Symbol(
  "FULL_CHAIN_LANDING_REPOSITORY",
);

export type StageFullChainLandingInput = {
  tenantId: string;
  actorId: string;
  traceId: string;
  idempotencyKey: string;
  manifest: Record<string, unknown>;
  graph: FullChainLandingGraph;
};
export type FullChainLandingState =
  "staged" | "receipt_pending" | "reconciling" | "published";
export type FullChainLandingStatus = {
  runId: string;
  state: FullChainLandingState;
  inputCounts: Record<string, number>;
  appliedCounts: Record<string, number>;
  replayedCounts: Record<string, number>;
  rejectedCounts: Record<string, number>;
  gapCount: number;
  checkCount: number;
  publishedAt: Date | null;
};
export type LandingReconciliation = {
  projectionHash: string;
  factCounts: Record<string, number>;
  relationCounts: Record<string, number>;
  receiptCount: number;
  gapCount: number;
  outboxCount: number;
  businessTaskCount: number;
};
export type PublishedFullChain = Record<string, unknown>;

export interface FullChainLandingRepository {
  stage(input: StageFullChainLandingInput): Promise<{
    runId: string;
    state: FullChainLandingState;
    replayed: boolean;
  }>;
  markReceiptPending(input: {
    runId: string;
    tenantId: string;
    errorCode: string;
  }): Promise<void>;
  markReconciling(input: {
    runId: string;
    tenantId: string;
    receiptKeyHash: string;
    receiptDigest: string;
  }): Promise<void>;
  reconcile(input: {
    runId: string;
    tenantId: string;
  }): Promise<LandingReconciliation>;
  publish(input: {
    runId: string;
    tenantId: string;
    reconciliation: LandingReconciliation;
    traceId: string;
  }): Promise<void>;
  getStatus(input: {
    runId: string;
    tenantId: string;
  }): Promise<FullChainLandingStatus | null>;
  getChain(input: {
    runId: string;
    tenantId: string;
    planNumber: string;
  }): Promise<PublishedFullChain | null>;
}
