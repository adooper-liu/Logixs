import type { FullChainLandingGraph } from "./landing-graph";

export const FULL_CHAIN_LANDING_REPOSITORY = Symbol(
  "FULL_CHAIN_LANDING_REPOSITORY",
);

export type StageFullChainLandingInput = {
  runId: string;
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
export type PublishedFullChain = {
  planNumber: string;
  booking: {
    bookingNumber: string;
    displayGroupRefs: unknown;
    documents: Array<{
      type: "mbl" | "hbl";
      number: string;
      parentNumber: string | null;
    }>;
  };
  cargoReady: Array<{
    cargoReadyNumber: string;
    displayGroupRef: string;
    quantity: string;
  }>;
  stuffing: Array<{
    containerNumber: string;
    cargoReadyNumber: string;
    sku: string;
    houseBill: { type: "hbl"; number: string };
    quantity: string;
    grossWeight: string;
    volume: string;
  }>;
  exportCustoms: Array<{
    invoiceNumber: string;
    houseBill: { type: "hbl"; number: string };
    declarationNumber: string;
    amount: string;
    currency: string;
  }>;
  dispatch: Array<{
    containerNumber: string;
    vesselName: string;
    voyageNumber: string;
    masterBill: { type: "mbl"; number: string };
    houseBills: Array<{ type: "hbl"; number: string }>;
    gateInDate: string;
    departedAt: string;
    departedPrecision: string;
    motherVesselDepartedAt: string;
  }>;
  gaps: Array<{ code: string; status: string }>;
};

export interface FullChainLandingRepository {
  findByPackage(input: {
    tenantId: string;
    packageHash: string;
  }): Promise<FullChainLandingStatus | null>;
  stage(input: StageFullChainLandingInput): Promise<{
    runId: string;
    state: FullChainLandingState;
    replayed: boolean;
    createdAt: Date;
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
