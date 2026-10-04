import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  assertProductInitiativeEvidenceRefs,
  prepareProductInitiativeDecision,
  ProductInitiativeNotFoundError,
} from "../domain/product-initiative";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRecord,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

const MARKET_SIGNAL_SUBJECT = "market_signal";

@Injectable()
export class DecideProductInitiativeService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly opportunities: ProductOpportunityRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ProductInitiativeDecisionCommandV1;
  }): Promise<ProductInitiativeV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const currentVersion = await this.repository.currentVersion(
        input.tenantId,
        input.handoffId,
      );
      const prepared = prepareProductInitiativeDecision(
        { version: currentVersion },
        input.actorId,
        input.command,
      );
      const opportunity = await this.opportunities.findByHandoffId(
        input.tenantId,
        input.handoffId,
      );
      if (!opportunity) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND",
        );
      }
      const signalId = opportunity.handoff.signalId;
      const evidenceRefs = await this.evidenceReader.execute({
        tenantId: input.tenantId,
        subjectType: MARKET_SIGNAL_SUBJECT,
        subjectIds: [signalId],
      });
      assertProductInitiativeEvidenceRefs(
        prepared,
        evidenceRefs[signalId] ?? [],
      );
      const result = await this.repository.persistDecision({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        actorId: input.actorId,
        command: prepared,
      });
      return toProductInitiativeV1(result.record);
    } catch (error) {
      throwProductInitiativeHttpError(error);
    }
  }
}

export function toProductInitiativeV1(
  record: ProductInitiativeRecord,
): ProductInitiativeV1 {
  return {
    initiativeId: record.initiativeId,
    outcome: record.outcome,
    completion: record.completion,
    currentDestination: record.currentDestination,
    responsibleActorId: record.responsibleActorId,
    responsibilityAccepted: record.responsibilityAccepted,
    receivingTeamOrRole: record.receivingTeamOrRole,
    resourceDescription: record.resourceDescription,
    targetDate: dateOnly(record.targetDate),
    nextDecisionDate: dateOnly(record.nextDecisionDate),
    nextDecisionQuestion: record.nextDecisionQuestion,
    validationFocus: record.validationFocus,
    reconsiderationDate: dateOnly(record.reconsiderationDate),
    objective: record.objective,
    reviewPoints: record.reviewPoints,
    reason: record.reason,
    returnBasis: record.returnBasis,
    pendingFieldCodes: record.pendingFieldCodes,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}
