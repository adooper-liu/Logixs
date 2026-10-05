import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { ProductInitiativeDetailV1 } from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  REFERENCE_CURRENCY_DIRECTORY,
  type ReferenceCurrencyDirectoryPort,
} from "../../master-data";
import { ProductInitiativeNotFoundError } from "../domain/product-initiative";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { toProductInitiativeV1 } from "./decide-product-initiative.service";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

/** 证据挂在来源信号上；立项只引用，不另存事实。 */
const MARKET_SIGNAL_SUBJECT = "market_signal";

@Injectable()
export class GetProductInitiativeService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly opportunities: ProductOpportunityRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
    @Inject(REFERENCE_CURRENCY_DIRECTORY)
    private readonly currencies: ReferenceCurrencyDirectoryPort,
  ) {}

  async execute(input: {
    tenantId: string;
    handoffId: string;
  }): Promise<ProductInitiativeDetailV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const record = await this.repository.findByHandoffId(
        input.tenantId,
        input.handoffId,
      );
      // 还没有立项判断时，从机会本身取信号，才能列出可引用的证据。
      const signalId =
        record?.signalId ??
        (
          await this.opportunities.findByHandoffId(
            input.tenantId,
            input.handoffId,
          )
        )?.handoff.signalId;
      if (!signalId) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND",
        );
      }
      const [candidates, currencies] = await Promise.all([
        this.evidenceReader.executeDetails({
          tenantId: input.tenantId,
          subjectType: MARKET_SIGNAL_SUBJECT,
          subjectIds: [signalId],
        }),
        this.currencies.listActive(),
      ]);
      return {
        handoffId: input.handoffId,
        initiative: record ? toProductInitiativeV1(record) : null,
        currencyOptions: currencies
          .map((currency) => ({
            code: currency.alphaCode,
            name: currency.currencyName,
            minorUnit: currency.minorUnit,
          }))
          .sort((left, right) => left.code.localeCompare(right.code)),
        evidenceCandidates: candidates.map((candidate) => ({
          evidenceId: candidate.evidenceId,
          sourceName: candidate.sourceName,
          summary: candidate.summary,
          contentRef: candidate.contentRef,
          recordedAt: candidate.recordedAt.toISOString(),
        })),
      };
    } catch (error) {
      throwProductInitiativeHttpError(error);
    }
  }
}
