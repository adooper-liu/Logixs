import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  MarketSignalCreateCommandV1,
  MarketSignalV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import { normalizeMarketSignalCreate } from "../domain/market-signal";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";
import { throwMarketSignalHttpError } from "./market-signal-errors";
import { presentMarketSignal } from "./market-signal.presenter";

@Injectable()
export class CreateMarketSignalService {
  constructor(
    @Inject(MARKET_SIGNAL_REPOSITORY)
    private readonly repository: MarketSignalRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    command: MarketSignalCreateCommandV1;
  }): Promise<MarketSignalV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const command = normalizeMarketSignalCreate(input.command);
      if (command.evidenceRefs.length > 0) {
        const linked = await this.evidenceReader.execute({
          tenantId: input.tenantId,
          subjectType: "market_signal",
          subjectIds: [command.signalId],
        });
        const available = new Set(linked[command.signalId] ?? []);
        if (command.evidenceRefs.some((id) => !available.has(id))) {
          throw new HttpException(
            "EVIDENCE_REFERENCE_INVALID",
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
      const result = await this.repository.create({
        tenantId: input.tenantId,
        actorId: input.actorId,
        command,
      });
      return presentMarketSignal(result.record, command.evidenceRefs);
    } catch (error) {
      throwMarketSignalHttpError(error);
    }
  }
}
