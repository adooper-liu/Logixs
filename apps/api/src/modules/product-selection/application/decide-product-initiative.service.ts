import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  REFERENCE_CURRENCY_DIRECTORY,
  type ReferenceCurrencyDirectoryPort,
} from "../../master-data";
import {
  READ_MARKET_SIGNAL_LIVE,
  type ReadMarketSignalLivePort,
} from "../../market-intelligence";
import { mergeHandoffWithSignalLive } from "../domain/merge-handoff-with-signal";
import {
  assertProductInitiativeEvidenceRefs,
  prepareProductInitiativeDecision,
  ProductInitiativeNotFoundError,
} from "../domain/product-initiative";
import { requestedUnitEconomicsCurrencyCode } from "../domain/unit-economics";
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
    @Inject(REFERENCE_CURRENCY_DIRECTORY)
    private readonly currencies: ReferenceCurrencyDirectoryPort,
    @Optional()
    @Inject(READ_MARKET_SIGNAL_LIVE)
    private readonly signalLive: ReadMarketSignalLivePort | null = null,
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
      const opportunity = await this.opportunities.findByHandoffId(
        input.tenantId,
        input.handoffId,
      );
      if (!opportunity) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND",
        );
      }
      const live = await this.loadLive(
        input.tenantId,
        opportunity.handoff.signalId,
      );
      const workingHandoff = mergeHandoffWithSignalLive(
        opportunity.handoff,
        live,
      ).display;
      const currencyCode = requestedUnitEconomicsCurrencyCode(
        input.command.unitEconomicsDraft,
      );
      const [currentVersion, currencyResolution] = await Promise.all([
        this.repository.currentVersion(input.tenantId, input.handoffId),
        currencyCode
          ? this.currencies.resolve(currencyCode).then(({ status }) => status)
          : Promise.resolve(null),
      ]);
      const prepared = prepareProductInitiativeDecision(
        { version: currentVersion },
        input.actorId,
        input.command,
        undefined,
        undefined,
        {
          marketCode: workingHandoff.marketCode ?? null,
          channelCode: workingHandoff.channelCode ?? null,
          currencyResolution,
        },
      );
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

  private async loadLive(tenantId: string, signalId: string) {
    if (!this.signalLive) return null;
    const [row] = await this.signalLive.execute({
      tenantId,
      signalIds: [signalId],
    });
    return row ? { ...row, evidenceRefs: [] } : null;
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
    unitEconomicsDraft: record.unitEconomicsDraft,
    unitEconomicsSnapshot: record.unitEconomicsSnapshot,
    negativeConservativeReason: record.negativeConservativeReason,
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
