import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductInitiativeDecisionDraftV1,
  SaveProductInitiativeDecisionDraftCommandV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  assertProductInitiativeEvidenceRefs,
  ProductInitiativeNotFoundError,
} from "../domain/product-initiative";
import {
  prepareProductInitiativeDecisionDraft,
  ProductInitiativeDraftConflictError,
  ProductInitiativeDraftValidationError,
} from "../domain/product-initiative-draft";
import {
  PRODUCT_INITIATIVE_DRAFT_REPOSITORY,
  type ProductInitiativeDecisionDraftRecord,
  type ProductInitiativeDraftRepository,
} from "../domain/product-initiative-draft.repository";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

const MARKET_SIGNAL_SUBJECT = "market_signal";

@Injectable()
export class SaveProductInitiativeDraftService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_DRAFT_REPOSITORY)
    private readonly drafts: ProductInitiativeDraftRepository,
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly initiatives: ProductInitiativeRepository,
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly opportunities: ProductOpportunityRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: SaveProductInitiativeDecisionDraftCommandV1;
  }): Promise<ProductInitiativeDecisionDraftV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const opportunity = await this.opportunities.findByHandoffId(
        input.tenantId,
        input.handoffId,
      );
      if (!opportunity || opportunity.intakeState !== "accepted") {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_OPPORTUNITY_NOT_ACCEPTED",
        );
      }
      const replay = await this.drafts.findByIdempotencyKey(
        input.tenantId,
        input.command.idempotencyKey,
      );
      if (replay) {
        const preparedReplay = prepareProductInitiativeDecisionDraft(
          input.actorId,
          input.command,
          {
            draftVersion: input.command.expectedDraftVersion,
            initiativeVersion: input.command.initiativeVersionSeen,
          },
        );
        if (replay.payloadHash !== preparedReplay.payloadHash) {
          throw new ProductInitiativeDraftConflictError(
            "PRODUCT_INITIATIVE_DRAFT_IDEMPOTENCY_CONFLICT",
          );
        }
        return toDraftV1(replay.record);
      }
      const [currentDraft, initiative] = await Promise.all([
        this.drafts.findByHandoffId(input.tenantId, input.handoffId),
        this.initiatives.findByHandoffId(input.tenantId, input.handoffId),
      ]);
      const initiativeVersion = initiative?.version ?? 0;
      const prepared = prepareProductInitiativeDecisionDraft(
        input.actorId,
        input.command,
        {
          draftVersion: currentDraft?.draftVersion ?? 0,
          initiativeVersion,
        },
      );
      const evidence = await this.evidenceReader.execute({
        tenantId: input.tenantId,
        subjectType: MARKET_SIGNAL_SUBJECT,
        subjectIds: [opportunity.handoff.signalId],
      });
      assertProductInitiativeEvidenceRefs(
        prepared,
        evidence[opportunity.handoff.signalId] ?? [],
      );
      const result = await this.drafts.persist({
        tenantId: input.tenantId,
        actorId: input.actorId,
        handoffId: input.handoffId,
        initiativeId: initiative?.initiativeId ?? null,
        command: prepared,
      });
      return toDraftV1(result.record);
    } catch (error) {
      if (
        error instanceof ProductInitiativeDraftValidationError ||
        error instanceof ProductInitiativeDraftConflictError
      ) {
        throwProductInitiativeHttpError(error);
      }
      throwProductInitiativeHttpError(error);
    }
  }
}

export function toDraftV1(
  record: ProductInitiativeDecisionDraftRecord,
): ProductInitiativeDecisionDraftV1 {
  return {
    contractVersion: "product-initiative-decision-draft.v1",
    draftId: record.draftId,
    handoffId: record.handoffId,
    draftVersion: record.draftVersion,
    initiativeVersionSeen: record.initiativeVersionSeen,
    objective: record.objective,
    reviewPoints: record.reviewPoints,
    businessCaseDraft: record.businessCaseDraft,
    riskAssessmentDraft: record.riskAssessmentDraft,
    unitEconomicsDraft: record.unitEconomicsDraft,
    negativeConservativeReason: record.negativeConservativeReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
