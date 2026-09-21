import { describe, expect, it } from "vitest";
import { decideNodeSpecializedGuard } from "./node-specialized-guard";

const FINAL_ROUTE_SEGMENT = {
  routePlanId: "22222222-2222-4222-8222-222222222222",
  routeVersion: 1,
  segmentId: "11111111-1111-4111-8111-111111111111",
  sequence: 1,
  isFinal: true,
  destinationLocationType: "port" as const,
  destinationUnlocode: "USLAX",
  destinationLocationId: null,
  destinationPortCallId: null,
};

describe("decideNodeSpecializedGuard", () => {
  it("cargo_ready 只有当前合规决定已放行才允许过站", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "cargo_ready",
        eventCode: "cargo_ready",
        containerNumber: null,
        location: null,
        routeSegment: null,
        cargoReadyComplianceApproved: false,
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_COMPLIANCE",
    });
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "cargo_ready",
        eventCode: "cargo_ready",
        containerNumber: null,
        location: null,
        routeSegment: null,
        cargoReadyComplianceApproved: true,
      }),
    ).toEqual({
      kind: "apply",
      guardResults: ["CARGO_READY_COMPLIANCE_APPROVED"],
    });
  });

  it("箱号未迟绑定时保留 stuffed 待应用", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "container_stuffing",
        eventCode: "stuffed",
        containerNumber: null,
        location: null,
        routeSegment: null,
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_CONTAINER_IDENTITY",
    });
  });

  it("箱号已绑定时允许 stuffed 继续执行通用过站事务", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "container_stuffing",
        eventCode: "stuffed",
        containerNumber: " MSKU1234567 ",
        location: null,
        routeSegment: null,
        stuffingReadiness: { confirmed: true, reasonCode: null },
      }),
    ).toEqual({
      kind: "apply",
      guardResults: [
        "CONTAINER_IDENTITY_BOUND",
        "CONTAINER_STUFFING_SNAPSHOT_CURRENT",
        "CONTAINER_STUFFING_EVIDENCE_LINKED",
      ],
    });
  });

  it.each([
    "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT",
    "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT_STALE",
    "LIFECYCLE_EVENT_PENDING_STUFFING_EVIDENCE",
  ])("装箱就绪条件不满足时保留 stuffed 待应用：%s", (reasonCode) => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "container_stuffing",
        eventCode: "stuffed",
        containerNumber: "MSKU1234567",
        location: null,
        routeSegment: null,
        stuffingReadiness: { confirmed: false, reasonCode },
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: ["CONTAINER_IDENTITY_BOUND"],
      reasonCode,
    });
  });

  it("出运快照未确认时保留 loaded 待应用", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "shipment_dispatch",
        eventCode: "loaded",
        containerNumber: null,
        location: null,
        routeSegment: null,
        dispatchReadiness: {
          confirmed: false,
          reasonCode: "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT",
        },
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT",
    });
  });

  it("当前出运交接和证据均确认后允许 loaded 继续通用过站", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "shipment_dispatch",
        eventCode: "loaded",
        containerNumber: "KOCU4960726",
        location: null,
        routeSegment: null,
        dispatchReadiness: { confirmed: true, reasonCode: null },
      }),
    ).toEqual({
      kind: "apply",
      guardResults: [
        "CONTAINER_DISPATCH_SNAPSHOT_CURRENT",
        "CONTAINER_DISPATCH_STUFFING_CURRENT",
        "CONTAINER_DISPATCH_VGM_ACCEPTED",
        "CONTAINER_DISPATCH_EVIDENCE_LINKED",
      ],
    });
  });

  it.each([
    ["arrived", "destination_arrival"],
    ["arrived", "ocean_transit"],
    ["transit_arrived", "ocean_transit"],
  ] as const)("%s 缺地点航段时把 %s 留待应用", (eventCode, targetNodeCode) => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode,
        eventCode,
        containerNumber: "MSKU1234567",
        location: null,
        routeSegment: null,
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_LOCATION_CONTEXT",
    });
  });

  it("可识别港口与航段齐全时允许 arrived 继续执行通用守卫", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "destination_arrival",
        eventCode: "arrived",
        containerNumber: "MSKU1234567",
        location: {
          locationType: "port",
          unlocode: "USLAX",
          segmentId: "11111111-1111-4111-8111-111111111111",
          timezone: "America/Los_Angeles",
        },
        routeSegment: FINAL_ROUTE_SEGMENT,
      }),
    ).toEqual({
      kind: "apply",
      guardResults: [
        "ARRIVAL_LOCATION_IDENTIFIED",
        "ARRIVAL_SEGMENT_IDENTIFIED",
        "ARRIVAL_ROUTE_ACTIVE",
        "ARRIVAL_SEGMENT_MATCHED",
        "ARRIVAL_DESTINATION_MATCHED",
      ],
    });
  });

  it("只有地点或只有航段都不足以完成到港", () => {
    const base = {
      targetNodeCode: "destination_arrival" as const,
      eventCode: "arrived" as const,
      containerNumber: "MSKU1234567",
    };
    expect(
      decideNodeSpecializedGuard({
        ...base,
        location: {
          locationType: "port",
          unlocode: "USLAX",
          timezone: "America/Los_Angeles",
        },
        routeSegment: null,
      }).kind,
    ).toBe("pending_application");
    expect(
      decideNodeSpecializedGuard({
        ...base,
        location: {
          locationType: "in_transit",
          segmentId: "11111111-1111-4111-8111-111111111111",
          timezone: "Etc/UTC",
        },
        routeSegment: null,
      }).kind,
    ).toBe("pending_application");
  });

  it("地点航段齐全但没有当前权威路线时继续等待", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "destination_arrival",
        eventCode: "arrived",
        containerNumber: "MSKU1234567",
        location: {
          locationType: "port",
          unlocode: "USLAX",
          segmentId: FINAL_ROUTE_SEGMENT.segmentId,
          timezone: "America/Los_Angeles",
        },
        routeSegment: null,
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: [
        "ARRIVAL_LOCATION_IDENTIFIED",
        "ARRIVAL_SEGMENT_IDENTIFIED",
      ],
      reasonCode: "LIFECYCLE_EVENT_PENDING_ROUTE_CONTEXT",
    });
  });

  it.each([
    ["arrived", { ...FINAL_ROUTE_SEGMENT, isFinal: false }],
    ["transit_arrived", FINAL_ROUTE_SEGMENT],
    ["arrived", { ...FINAL_ROUTE_SEGMENT, destinationUnlocode: "USLGB" }],
    [
      "arrived",
      {
        ...FINAL_ROUTE_SEGMENT,
        destinationLocationType: "terminal",
        destinationLocationId: "33333333-3333-4333-8333-333333333333",
      },
    ],
  ] as const)("%s 与权威路线不匹配时不允许过站", (eventCode, routeSegment) => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "ocean_transit",
        eventCode,
        containerNumber: "MSKU1234567",
        location: {
          locationType: "port",
          unlocode: "USLAX",
          segmentId: FINAL_ROUTE_SEGMENT.segmentId,
          timezone: "America/Los_Angeles",
        },
        routeSegment,
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: ["ARRIVAL_ROUTE_ACTIVE"],
      reasonCode: "LIFECYCLE_EVENT_ROUTE_MISMATCH",
    });
  });

  it("中转到港只接受当前路线中的非最终航段", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "ocean_transit",
        eventCode: "transit_arrived",
        containerNumber: "MSKU1234567",
        location: {
          locationType: "port",
          unlocode: "SGSIN",
          segmentId: FINAL_ROUTE_SEGMENT.segmentId,
          timezone: "Asia/Singapore",
        },
        routeSegment: {
          ...FINAL_ROUTE_SEGMENT,
          isFinal: false,
          destinationUnlocode: "SGSIN",
        },
      }).kind,
    ).toBe("apply");
  });
});
