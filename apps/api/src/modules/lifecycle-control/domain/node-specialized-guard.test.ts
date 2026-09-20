import { describe, expect, it } from "vitest";
import { decideNodeSpecializedGuard } from "./node-specialized-guard";

describe("decideNodeSpecializedGuard", () => {
  it("箱号未迟绑定时保留 stuffed 待应用", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "container_stuffing",
        eventCode: "stuffed",
        containerNumber: null,
        location: null,
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
      }),
    ).toEqual({
      kind: "apply",
      guardResults: ["CONTAINER_IDENTITY_BOUND"],
    });
  });

  it("不替其他节点臆造专项条件", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "shipment_dispatch",
        eventCode: "loaded",
        containerNumber: null,
        location: null,
      }),
    ).toEqual({ kind: "apply", guardResults: [] });
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
      }),
    ).toEqual({
      kind: "apply",
      guardResults: [
        "ARRIVAL_LOCATION_IDENTIFIED",
        "ARRIVAL_SEGMENT_IDENTIFIED",
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
      }).kind,
    ).toBe("pending_application");
  });
});
