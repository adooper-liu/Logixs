import type { MarketSignalV1 } from "@logix/contracts";
import { pendingFieldCodes } from "../domain/market-signal";
import type { MarketSignalRecord } from "../domain/market-signal.repository";

export function presentMarketSignal(
  record: MarketSignalRecord,
  evidenceRefs: string[],
): MarketSignalV1 {
  return {
    signalId: record.id,
    title: record.title,
    marketCode: record.marketCode,
    channelCode: record.channelCode,
    categoryRef: record.categoryRef,
    observedFactSummary: record.observedFactSummary,
    hypothesis: record.hypothesis,
    evidenceRefs,
    currentDestination: record.currentDestination,
    ownerTeamCode: record.ownerTeamCode,
    activeValidation: record.activeValidation,
    version: record.version,
    pendingFieldCodes: pendingFieldCodes({ ...record, evidenceRefs }),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
