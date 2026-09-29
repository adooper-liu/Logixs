import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import type {
  ProductOpportunityIntakeCommandV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  READ_MARKET_SIGNAL_LIVE,
  type ReadMarketSignalLivePort,
} from "../../market-intelligence";
import {
  ProductOpportunityNotFoundError,
  prepareOpportunityIntake,
} from "../domain/product-opportunity";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { throwProductOpportunityHttpError } from "./product-opportunity-errors";
import { toOpportunityV1 } from "./list-product-opportunities.service";

const MARKET_SIGNAL_SUBJECT = "market_signal";

@Injectable()
export class IntakeProductOpportunityService {
  constructor(
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly repository: ProductOpportunityRepository,
    @Optional()
    @Inject(READ_MARKET_SIGNAL_LIVE)
    private readonly signalLive: ReadMarketSignalLivePort | null = null,
    @Optional()
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort | null = null,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ProductOpportunityIntakeCommandV1;
  }): Promise<ProductOpportunityV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const current = await this.repository.findByHandoffId(
        input.tenantId,
        input.handoffId,
      );
      if (!current) {
        throw new ProductOpportunityNotFoundError(
          "PRODUCT_OPPORTUNITY_NOT_FOUND",
        );
      }
      const result = await this.repository.appendIntake({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        actorId: input.actorId,
        command: prepareOpportunityIntake(
          {
            version: current.intakeVersion,
            state: current.intakeState,
            assignedActorId: current.assignedActorId,
          },
          input.actorId,
          input.command,
        ),
      });
      const live = await this.loadLive(
        input.tenantId,
        result.record.handoff.signalId,
      );
      return toOpportunityV1(result.record, live);
    } catch (error) {
      throwProductOpportunityHttpError(error);
    }
  }

  private async loadLive(tenantId: string, signalId: string) {
    if (!this.signalLive) return null;
    const [row] = await this.signalLive.execute({
      tenantId,
      signalIds: [signalId],
    });
    if (!row) return null;
    const evidence =
      this.evidenceReader != null
        ? await this.evidenceReader.execute({
            tenantId,
            subjectType: MARKET_SIGNAL_SUBJECT,
            subjectIds: [signalId],
          })
        : {};
    return {
      marketCode: row.marketCode,
      channelCode: row.channelCode,
      categoryRef: row.categoryRef,
      observedFactSummary: row.observedFactSummary,
      hypothesis: row.hypothesis,
      evidenceRefs: evidence[signalId] ?? [],
    };
  }
}
