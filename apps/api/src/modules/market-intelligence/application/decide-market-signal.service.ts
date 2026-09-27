import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  MarketSignalDecisionCommandV1,
  MarketSignalDecisionResultV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  MarketSignalNotFoundError,
  prepareMarketSignalDecision,
} from "../domain/market-signal";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";
import { throwMarketSignalHttpError } from "./market-signal-errors";
import { presentMarketSignal } from "./market-signal.presenter";

@Injectable()
export class DecideMarketSignalService {
  constructor(
    @Inject(MARKET_SIGNAL_REPOSITORY)
    private readonly repository: MarketSignalRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    signalId: string;
    command: MarketSignalDecisionCommandV1;
  }): Promise<MarketSignalDecisionResultV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const signal = await this.repository.findById(
        input.tenantId,
        input.signalId,
      );
      if (!signal)
        throw new MarketSignalNotFoundError("MARKET_SIGNAL_NOT_FOUND");
      const evidence = await this.evidenceReader.execute({
        tenantId: input.tenantId,
        subjectType: "market_signal",
        subjectIds: [input.signalId],
      });
      const evidenceRefs = evidence[input.signalId] ?? [];
      const persisted = await this.repository.decide({
        tenantId: input.tenantId,
        signalId: input.signalId,
        actorId: input.actorId,
        evidenceRefs,
        prepared: prepareMarketSignalDecision(
          { ...signal, evidenceRefs },
          input.command,
        ),
      });
      return {
        contractVersion: "market-signal-decision-result.v1",
        status: persisted.duplicate ? "duplicate" : "saved",
        signal: presentMarketSignal(persisted.signal, evidenceRefs),
        decisionId: persisted.decision.id,
        decisionVersion: persisted.decision.version,
        completion: persisted.decision.completion,
        handoff: persisted.handoff,
      };
    } catch (error) {
      throwMarketSignalHttpError(error);
    }
  }
}
