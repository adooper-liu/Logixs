import { describe, expect, it } from "vitest";
import type {
  ShipmentRiskQueueEntryV1,
  ShipmentWorkHandoffV1,
} from "../api/shipments";
import { groupOf, remainingLabel } from "./useShipmentRiskWorkbench";

const NOW = new Date("2026-09-28T12:00:00.000Z");

describe("remainingLabel 只报事实，不设「临期」阈值", () => {
  it("还没到时说还剩多久", () => {
    expect(remainingLabel("2026-09-30T16:00:00.000Z", NOW)).toBe(
      "还有 2 天 4 小时",
    );
  });

  it("过了时说逾期多久 —— 阈值是业务政策，这里只给事实", () => {
    expect(remainingLabel("2026-09-27T12:00:00.000Z", NOW)).toBe(
      "已逾期 1 天 0 小时",
    );
  });

  it("没有截止时如实说没有，不编一个时间", () => {
    expect(remainingLabel(null, NOW)).toBe("没有截止");
    expect(remainingLabel(undefined, NOW)).toBe("没有截止");
  });
});

describe("分组按「该谁动」，不按严重度", () => {
  it("有未解决异常时进「先处理异常」", () => {
    expect(groupOf(entry({ openExceptionCount: 2 }), [])).toBe("exceptions");
  });

  it("有已交出去、还没了结的事时进「等待他人」", () => {
    expect(groupOf(entry({}), [handoff({ state: "raised" })])).toBe("waiting");
  });

  it("两样都没有时才是「待我处理」", () => {
    expect(groupOf(entry({}), [])).toBe("mine");
  });

  it("异常优先于等待 —— 一票只进一组，不重复出现", () => {
    // 既逾期又已经交出去了：异常挡在前面，先处理它。
    expect(
      groupOf(entry({ openExceptionCount: 1 }), [
        handoff({ state: "claimed" }),
      ]),
    ).toBe("exceptions");
  });

  it("临期不参与分组 —— 一件票可以既临期又待我", () => {
    // 这条是这一片的关键：按"临期"分组会把最该被看见的那批从"待我"里挪走。
    const overdue = entry({
      reasons: ["overdue_deadline"],
      nearestDeadline: { kind: "eta", at: "2026-09-01T00:00:00.000Z" },
    });

    expect(groupOf(overdue, [])).toBe("mine");
  });
});

function entry(overrides: {
  openExceptionCount?: number;
  reasons?: ShipmentRiskQueueEntryV1["risk"]["reasons"];
  nearestDeadline?: ShipmentRiskQueueEntryV1["risk"]["nearestDeadline"];
}): ShipmentRiskQueueEntryV1 {
  return {
    shipment: {
      id: "11111111-1111-4111-8111-111111111111",
      shipmentNumber: "SHIP-1",
      transportMode: "ocean",
      carrierCode: "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originCountryCode: "CN",
      originUnlocode: "CNNGB",
      destinationCountryCode: "US",
      destinationUnlocode: "USLAX",
      salesCountryCode: null,
      cargoOwnerReferenceId: null,
      cargoOwnerName: null,
      atdAt: null,
      etaAt: null,
      currentLifecycleStatus: "in_transit",
      lifecycleVersion: 1,
      relationshipVersion: 1,
      activeContainerCount: 1,
      activeCargoLineCount: 1,
      lifecycleInitializationState: "ready",
      updatedAt: "2026-09-28T10:00:00.000Z",
    },
    risk: {
      nearestDeadline: overrides.nearestDeadline ?? null,
      overdue: false,
      reasons: overrides.reasons ?? [],
      openExceptionCount: overrides.openExceptionCount ?? 0,
      unassignedExceptionCount: 0,
    },
    pendingItems: [],
  };
}

function handoff(overrides: {
  state: ShipmentWorkHandoffV1["state"];
}): ShipmentWorkHandoffV1 {
  return {
    contractVersion: "shipment-work-handoff.v1",
    handoffId: "22222222-2222-4222-8222-222222222222",
    shipmentId: "11111111-1111-4111-8111-111111111111",
    containerRecordId: null,
    recipientQueueCode: "customs",
    title: "缺随车单",
    detail: null,
    state: overrides.state,
    version: 1,
    raisedBy: "dev-operator",
    raisedAt: "2026-09-28T10:00:00.000Z",
    claimedByActorId: null,
    claimedAt: null,
    closedByActorId: null,
    closedAt: null,
    conclusion: null,
    createdAt: "2026-09-28T10:00:00.000Z",
    updatedAt: "2026-09-28T10:00:00.000Z",
  };
}
