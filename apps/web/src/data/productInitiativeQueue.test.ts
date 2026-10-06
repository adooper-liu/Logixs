import type { ProductInitiativeQueueEntryV1 } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import { initiativeQueueBadge } from "./productInitiativeQueue";

describe("initiativeQueueBadge", () => {
  it("没有立项记录就是还没看过：不给任何标记", () => {
    expect(initiativeQueueBadge(undefined)).toBeNull();
  });

  it("看过但先放着：标出来，并说清还缺几项", () => {
    expect(
      initiativeQueueBadge(
        entry({
          outcome: "defer",
          currentDestination: "needs_decision",
          pendingFieldCodes: ["defer_reason", "compliance_risk"],
        }),
      ),
    ).toEqual({ label: "看过，先放着", state: "pending", pendingCount: 2 });
  });

  it.each([
    ["deferred", "已暂缓"],
    ["rejected", "已记录不立项"],
    ["returned_to_market", "已退回经营团队"],
  ] as const)("已关闭的去向按业务说法标出：%s", (currentDestination, label) => {
    expect(
      initiativeQueueBadge(
        entry({ currentDestination, pendingFieldCodes: [] }),
      ),
    ).toEqual({ label, state: "closed", pendingCount: 0 });
  });

  it("已立项单独一种状态，不与已关闭混为一谈", () => {
    expect(
      initiativeQueueBadge(
        entry({ outcome: "approve", currentDestination: "handed_off" }),
      ),
    ).toEqual({ label: "已立项", state: "handed_off", pendingCount: 0 });
  });

  it("NPI 退回后选品侧可见并仍可再判", () => {
    expect(
      initiativeQueueBadge(
        entry({
          outcome: "returned_from_npi",
          currentDestination: "returned_from_npi",
          pendingFieldCodes: [],
        }),
      ),
    ).toEqual({ label: "NPI 退回", state: "pending", pendingCount: 0 });
  });
});

function entry(
  overrides: Partial<ProductInitiativeQueueEntryV1> = {},
): ProductInitiativeQueueEntryV1 {
  return {
    handoffId: "44444444-4444-4444-8444-444444444444",
    outcome: "defer",
    currentDestination: "needs_decision",
    queueGroup: "standard",
    reconsiderationDate: null,
    pendingFieldCodes: [],
    updatedAt: "2026-09-27T00:00:00.000Z",
    ...overrides,
  };
}
