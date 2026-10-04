import type { WorkbenchNetworkVolume } from "@logix/contracts";

export interface WorkbenchNetworkVolumeCounts {
  marketOpen: number;
  marketPendingAcceptance: number;
  marketWeeklyAccepts: number;
  selectionOpen: number;
  sourcingOpen: number;
  sourcingPendingAcceptance: number;
}

const UNDEFINED_METRIC = { state: "undefined" } as const;
const NOT_CONNECTED = { state: "not_connected" } as const;

export function utcWeekStart(now: Date): Date {
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysSinceMonday = (midnight.getUTCDay() + 6) % 7;
  midnight.setUTCDate(midnight.getUTCDate() - daysSinceMonday);
  return midnight;
}

export function assembleWorkbenchNetworkVolume(
  counts: WorkbenchNetworkVolumeCounts,
  now: Date,
): WorkbenchNetworkVolume {
  const weekStart = utcWeekStart(now);
  return {
    contractVersion: "workbench-network-volume.v1",
    weekStart: weekStart.toISOString(),
    currentPhase: null,
    global: {
      open: {
        state: "count",
        count: counts.marketOpen + counts.selectionOpen + counts.sourcingOpen,
      },
      weeklyFlow: NOT_CONNECTED,
      blocked: UNDEFINED_METRIC,
    },
    workbenches: [
      {
        code: "market_signals",
        open: { state: "count", count: counts.marketOpen },
        weeklyFlow: { state: "count", count: counts.marketWeeklyAccepts },
        blocked: UNDEFINED_METRIC,
      },
      {
        code: "product_selection",
        open: { state: "count", count: counts.selectionOpen },
        weeklyFlow: NOT_CONNECTED,
        blocked: UNDEFINED_METRIC,
      },
      {
        code: "sourcing",
        open: { state: "count", count: counts.sourcingOpen },
        weeklyFlow: NOT_CONNECTED,
        blocked: UNDEFINED_METRIC,
      },
    ],
    connections: [
      {
        fromCode: "market_signals",
        toCode: "product_selection",
        pendingAcceptance: {
          state: "count",
          count: counts.marketPendingAcceptance,
        },
        overdue: UNDEFINED_METRIC,
      },
      {
        fromCode: "product_selection",
        toCode: "product_npi",
        pendingAcceptance: NOT_CONNECTED,
        overdue: UNDEFINED_METRIC,
      },
      {
        fromCode: "sourcing",
        toCode: "demand_replenishment",
        pendingAcceptance: {
          state: "count",
          count: counts.sourcingPendingAcceptance,
        },
        overdue: UNDEFINED_METRIC,
      },
    ],
  };
}
