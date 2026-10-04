import { describe, expect, it } from "vitest";
import {
  assembleWorkbenchNetworkVolume,
  utcWeekStart,
} from "./workbench-network-volume";

describe("workbench network volume assembly", () => {
  it("uses the UTC Monday as the week boundary", () => {
    expect(
      utcWeekStart(new Date("2026-10-04T15:00:00.000Z")).toISOString(),
    ).toBe("2026-09-28T00:00:00.000Z");
    expect(
      utcWeekStart(new Date("2026-09-28T00:00:00.000Z")).toISOString(),
    ).toBe("2026-09-28T00:00:00.000Z");
  });

  it("does not turn missing facts into zero", () => {
    const volume = assembleWorkbenchNetworkVolume(
      {
        marketOpen: 5,
        marketPendingAcceptance: 2,
        marketWeeklyAccepts: 4,
        selectionOpen: 3,
        sourcingOpen: 1,
        sourcingPendingAcceptance: 1,
      },
      new Date("2026-10-04T15:00:00.000Z"),
    );

    expect(volume.currentPhase).toBeNull();
    expect(volume.global).toEqual({
      open: { state: "count", count: 9 },
      weeklyFlow: { state: "not_connected" },
      blocked: { state: "undefined" },
    });
    expect(volume.workbenches[1]).toMatchObject({
      code: "product_selection",
      weeklyFlow: { state: "not_connected" },
      blocked: { state: "undefined" },
    });
    expect(volume.connections[1]).toMatchObject({
      fromCode: "product_selection",
      toCode: "product_npi",
      pendingAcceptance: { state: "not_connected" },
      overdue: { state: "undefined" },
    });
    expect(volume.connections[0]?.overdue).toEqual({ state: "undefined" });
  });
});
