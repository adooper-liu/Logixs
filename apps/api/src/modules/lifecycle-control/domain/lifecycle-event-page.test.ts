import { describe, expect, it } from "vitest";
import {
  decodeLifecycleEventCursor,
  encodeLifecycleEventCursor,
} from "./lifecycle-event-page";

describe("lifecycle-event-page", () => {
  it("往返编码绑定租户与货柜", () => {
    const cursor = {
      tenantId: "t1",
      containerId: "c1",
      occurredAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "evt-1",
    };
    expect(
      decodeLifecycleEventCursor(encodeLifecycleEventCursor(cursor)),
    ).toEqual(cursor);
  });

  it("损坏 cursor 明确失败", () => {
    expect(() => decodeLifecycleEventCursor("not-a-cursor")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});
