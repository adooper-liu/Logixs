import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  MarketSignalUpdateCommandV1,
  MarketSignalV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import { normalizeMarketSignalUpdate } from "../domain/market-signal";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";
import { throwMarketSignalHttpError } from "./market-signal-errors";
import { presentMarketSignal } from "./market-signal.presenter";

@Injectable()
export class UpdateMarketSignalService {
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
    command: MarketSignalUpdateCommandV1;
  }): Promise<MarketSignalV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const result = await this.repository.updateFacts({
        tenantId: input.tenantId,
        actorId: input.actorId,
        signalId: input.signalId,
        command: normalizeMarketSignalUpdate(input.command),
      });
      const evidence = await this.evidenceReader.execute({
        tenantId: input.tenantId,
        subjectType: "market_signal",
        subjectIds: [input.signalId],
      });
      return presentMarketSignal(result.record, evidence[input.signalId] ?? []);
    } catch (error) {
      throwMarketSignalHttpError(error);
    }
  }
}
