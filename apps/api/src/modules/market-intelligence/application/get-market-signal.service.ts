import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { MarketSignalDetailV1 } from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import { MarketSignalNotFoundError } from "../domain/market-signal";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";
import { throwMarketSignalHttpError } from "./market-signal-errors";
import { presentMarketSignal } from "./market-signal.presenter";

@Injectable()
export class GetMarketSignalService {
  constructor(
    @Inject(MARKET_SIGNAL_REPOSITORY)
    private readonly repository: MarketSignalRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    signalId: string;
  }): Promise<MarketSignalDetailV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const signal = await this.repository.findById(
        input.tenantId,
        input.signalId,
      );
      if (!signal)
        throw new MarketSignalNotFoundError("MARKET_SIGNAL_NOT_FOUND");
      const [details, selectionReturn] = await Promise.all([
        this.evidenceReader.executeDetails({
          tenantId: input.tenantId,
          subjectType: "market_signal",
          subjectIds: [input.signalId],
        }),
        this.repository.findLatestSelectionReturn(
          input.tenantId,
          input.signalId,
        ),
      ]);
      const evidenceRefs = details.map(({ evidenceId }) => evidenceId);
      return {
        signal: presentMarketSignal(signal, evidenceRefs),
        evidence: details.map((detail) => ({
          evidenceId: detail.evidenceId,
          sourceName: detail.sourceName,
          summary: detail.summary,
          contentRef: detail.contentRef,
          recordedAt: detail.recordedAt.toISOString(),
          verificationState:
            detail.verificationState as MarketSignalDetailV1["evidence"][number]["verificationState"],
        })),
        selectionReturnReason: selectionReturn?.reason ?? null,
        selectionReturnBasis: selectionReturn?.basis ?? null,
      };
    } catch (error) {
      throwMarketSignalHttpError(error);
    }
  }
}
