import type {
  MarketOpportunityHandoffV1,
  MarketSignalDecisionCompletionV1,
  MarketSignalDecisionTypeV1,
  MarketSignalDestinationV1,
  MarketSignalPendingFieldCodeV1,
  MarketSelectionReturnBasisV1,
} from "@logix/contracts";
import type {
  NormalizedMarketSignalCreate,
  NormalizedMarketSignalUpdate,
  PreparedMarketSignalDecision,
} from "./market-signal";

export const MARKET_SIGNAL_REPOSITORY = Symbol("MarketSignalRepository");

export interface MarketSignalActiveValidationRecord {
  responsibleActorId: string;
  nextReviewDate: string;
  watchFocus: string | null;
  waitingReason: string | null;
}

export interface MarketSignalRecord {
  id: string;
  tenantId: string;
  title: string;
  marketCode: string | null;
  channelCode: string | null;
  categoryRef: string | null;
  observedFactSummary: string | null;
  hypothesis: string | null;
  currentDestination: MarketSignalDestinationV1;
  ownerTeamCode: string;
  activeValidation: MarketSignalActiveValidationRecord | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketSignalDecisionRecord {
  id: string;
  version: number;
  decisionType: MarketSignalDecisionTypeV1;
  completion: MarketSignalDecisionCompletionV1;
  pendingFieldCodes: MarketSignalPendingFieldCodeV1[];
}

export type MarketSignalListCursor =
  | { sort: "updated"; updatedAt: Date; id: string }
  | {
      sort: "watching_due";
      activeValidationDueDate: Date | null;
      updatedAt: Date;
      id: string;
    };

export interface MarketSignalListQuery {
  tenantId: string;
  destination?: MarketSignalDestinationV1;
  after?: MarketSignalListCursor;
  take: number;
}

export interface PersistMarketSignalDecisionInput {
  tenantId: string;
  signalId: string;
  actorId: string;
  evidenceRefs: string[];
  prepared: PreparedMarketSignalDecision;
}

export interface ApplySelectionReturnInput {
  tenantId: string;
  signalId: string;
  actorId: string;
  returnReason: string;
  returnBasis: MarketSelectionReturnBasisV1;
  idempotencyKey: string;
}
export interface TakeBackSelectionReturnInput {
  tenantId: string;
  signalId: string;
  actorId: string;
  expectedSignalVersion: number;
  returnReason: string;
  idempotencyKey: string;
}

export interface MarketSignalDecisionPersistenceResult {
  /** 该次判断写入后的信号；重放时也是当时的快照，不混入后续版本。 */
  signal: MarketSignalRecord;
  evidenceRefs: string[];
  decision: MarketSignalDecisionRecord;
  handoff: MarketOpportunityHandoffV1 | null;
  duplicate: boolean;
}

export interface MarketSignalRepository {
  create(input: {
    tenantId: string;
    actorId: string;
    command: NormalizedMarketSignalCreate;
  }): Promise<{ record: MarketSignalRecord; duplicate: boolean }>;
  findById(
    tenantId: string,
    signalId: string,
  ): Promise<MarketSignalRecord | null>;
  list(query: MarketSignalListQuery): Promise<MarketSignalRecord[]>;
  count(input: {
    tenantId: string;
    destination?: MarketSignalDestinationV1;
  }): Promise<number>;
  findLatestSelectionReturn(
    tenantId: string,
    signalId: string,
  ): Promise<{
    reason: string;
    basis: MarketSelectionReturnBasisV1 | null;
  } | null>;
  updateFacts(input: {
    tenantId: string;
    signalId: string;
    actorId: string;
    command: NormalizedMarketSignalUpdate;
  }): Promise<{ record: MarketSignalRecord; duplicate: boolean }>;
  decide(
    input: PersistMarketSignalDecisionInput,
  ): Promise<MarketSignalDecisionPersistenceResult>;
  /** 在调用方事务内写选品退回决策；与立项退回必须同事务。 */
  applySelectionReturnWithin(
    tx: unknown,
    input: ApplySelectionReturnInput,
  ): Promise<{ duplicate: boolean }>;
  takeBackSelectionReturnWithin(
    tx: unknown,
    input: TakeBackSelectionReturnInput,
  ): Promise<{ duplicate: boolean }>;
}
