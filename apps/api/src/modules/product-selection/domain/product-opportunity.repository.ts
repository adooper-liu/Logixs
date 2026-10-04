import type {
  MarketOpportunityHandoffV1,
  MarketOpportunityIntakeStateV1,
  ProductOpportunityLatestSelectionDecisionV1,
} from "@logix/contracts";
import type { PreparedOpportunityIntake } from "./product-opportunity";

export const PRODUCT_OPPORTUNITY_REPOSITORY = Symbol(
  "ProductOpportunityRepository",
);

export interface ProductOpportunityRecord {
  handoff: MarketOpportunityHandoffV1;
  intakeState: MarketOpportunityIntakeStateV1;
  intakeVersion: number;
  assignedActorId: string | null;
  claimedAt: Date | null;
  acceptedAt: Date | null;
  latestSelectionDecision:
    | (Omit<ProductOpportunityLatestSelectionDecisionV1, "decidedAt"> & {
        decidedAt: Date;
      })
    | null;
}

export interface ProductOpportunityRepository {
  list(input: {
    tenantId: string;
    signalId?: string;
    responsibilityStatus?: "retained_by_market" | "transferred_to_selection";
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ProductOpportunityRecord[]>;
  count(input: {
    tenantId: string;
    signalId?: string;
    responsibilityStatus?: "retained_by_market" | "transferred_to_selection";
  }): Promise<number>;
  findByHandoffId(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductOpportunityRecord | null>;
  appendIntake(input: {
    tenantId: string;
    handoffId: string;
    actorId: string;
    command: PreparedOpportunityIntake;
  }): Promise<{ record: ProductOpportunityRecord; duplicate: boolean }>;
}
