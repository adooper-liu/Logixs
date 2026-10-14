import type {
  ProductInitiativeBusinessCaseDimensionDraftV1,
  ProductInitiativeReviewPointV1,
  ProductInitiativeRiskAssessmentDraftV1,
  ProductInitiativeUnitEconomicsDraftV1,
} from "@logix/contracts";
import type { PreparedProductInitiativeDecisionDraft } from "./product-initiative-draft";

export const PRODUCT_INITIATIVE_DRAFT_REPOSITORY = Symbol(
  "ProductInitiativeDraftRepository",
);

export interface ProductInitiativeDecisionDraftRecord {
  draftId: string;
  handoffId: string;
  draftVersion: number;
  initiativeVersionSeen: number;
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPointV1[];
  businessCaseDraft: ProductInitiativeBusinessCaseDimensionDraftV1[];
  riskAssessmentDraft: ProductInitiativeRiskAssessmentDraftV1[];
  unitEconomicsDraft: ProductInitiativeUnitEconomicsDraftV1 | null;
  negativeConservativeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInitiativeDraftRepository {
  findByHandoffId(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeDecisionDraftRecord | null>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<{
    record: ProductInitiativeDecisionDraftRecord;
    payloadHash: string;
  } | null>;
  persist(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    initiativeId: string | null;
    command: PreparedProductInitiativeDecisionDraft;
  }): Promise<{
    record: ProductInitiativeDecisionDraftRecord;
    duplicate: boolean;
  }>;
  closeByHandoffId(tenantId: string, handoffId: string): Promise<void>;
}
