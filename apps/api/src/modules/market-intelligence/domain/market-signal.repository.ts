import type {
  MarketOpportunityHandoffV1,
  MarketSignalDecisionCompletionV1,
  MarketSignalDecisionTypeV1,
  MarketSignalDestinationV1,
  MarketSignalPendingFieldCodeV1,
} from "@logix/contracts";
import type {
  NormalizedMarketSignalCreate,
  NormalizedMarketSignalUpdate,
  PreparedMarketSignalDecision,
} from "./market-signal";

export const MARKET_SIGNAL_REPOSITORY = Symbol("MarketSignalRepository");

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

export interface MarketSignalListQuery {
  tenantId: string;
  after?: { updatedAt: Date; id: string };
  take: number;
}

export interface PersistMarketSignalDecisionInput {
  tenantId: string;
  signalId: string;
  actorId: string;
  evidenceRefs: string[];
  prepared: PreparedMarketSignalDecision;
}

export interface MarketSignalDecisionPersistenceResult {
  signal: MarketSignalRecord;
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
  updateFacts(input: {
    tenantId: string;
    signalId: string;
    actorId: string;
    command: NormalizedMarketSignalUpdate;
  }): Promise<{ record: MarketSignalRecord; duplicate: boolean }>;
  decide(
    input: PersistMarketSignalDecisionInput,
  ): Promise<MarketSignalDecisionPersistenceResult>;
}
