import type {
  MarketOpportunityHandoffV1,
  MarketOpportunityIntakeStateV1,
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
}

export interface ProductOpportunityRepository {
  list(input: {
    tenantId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ProductOpportunityRecord[]>;
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
