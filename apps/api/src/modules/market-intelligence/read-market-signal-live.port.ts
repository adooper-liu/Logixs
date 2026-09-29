import { Inject, Injectable } from "@nestjs/common";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalRepository,
} from "./domain/market-signal.repository";

export const READ_MARKET_SIGNAL_LIVE = Symbol.for("logix.ReadMarketSignalLive");

export interface MarketSignalLiveFields {
  signalId: string;
  marketCode: string | null;
  channelCode: string | null;
  categoryRef: string | null;
  observedFactSummary: string | null;
  hypothesis: string | null;
}

export interface ReadMarketSignalLivePort {
  execute(input: {
    tenantId: string;
    signalIds: readonly string[];
  }): Promise<MarketSignalLiveFields[]>;
}

@Injectable()
export class ReadMarketSignalLiveService implements ReadMarketSignalLivePort {
  constructor(
    @Inject(MARKET_SIGNAL_REPOSITORY)
    private readonly repository: MarketSignalRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    signalIds: readonly string[];
  }): Promise<MarketSignalLiveFields[]> {
    const unique = [...new Set(input.signalIds)];
    const rows = await Promise.all(
      unique.map((signalId) =>
        this.repository.findById(input.tenantId, signalId),
      ),
    );
    return rows.flatMap((record) =>
      record
        ? [
            {
              signalId: record.id,
              marketCode: record.marketCode,
              channelCode: record.channelCode,
              categoryRef: record.categoryRef,
              observedFactSummary: record.observedFactSummary,
              hypothesis: record.hypothesis,
            },
          ]
        : [],
    );
  }
}
