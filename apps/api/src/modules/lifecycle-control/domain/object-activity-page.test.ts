import { describe, expect, it } from "vitest";
import {
  decodeObjectActivityCursor,
  encodeObjectActivityCursor,
  mergeObjectActivities,
  parseObjectActivityPageSize,
  type ObjectActivityItem,
} from "./object-activity-page";

function activity(id: string, occurredAt: string): ObjectActivityItem {
  const at = new Date(occurredAt);
  return {
    id,
    activityCode: "task_created",
    sourceType: "node_task",
    sourceId: id,
    occurredAt: at,
    recordedAt: at,
    containerId: "container-1",
    taskId: null,
    workOrderId: null,
    actorId: null,
    nodeCode: null,
    title: null,
    detail: null,
    severity: null,
    targetPath: null,
  };
}

describe("object activity page", () => {
  it("keeps a snapshot offset cursor bound to tenant and container", () => {
    const encoded = encodeObjectActivityCursor({
      tenantId: "tenant-1",
      containerId: "container-1",
      asOf: new Date("2026-09-18T03:00:00.000Z"),
      offset: 20,
    });
    expect(decodeObjectActivityCursor(encoded)).toEqual({
      tenantId: "tenant-1",
      containerId: "container-1",
      asOf: new Date("2026-09-18T03:00:00.000Z"),
      offset: 20,
    });
    expect(() => decodeObjectActivityCursor("not-a-cursor")).toThrow(
      "VALIDATION_FORMAT",
    );
  });

  it("sorts newest first with a deterministic id tie-breaker", () => {
    expect(
      mergeObjectActivities([
        activity("notification:n1", "2026-09-18T02:00:00.000Z"),
        activity("task:t1", "2026-09-18T01:00:00.000Z"),
        activity("lifecycle:e1", "2026-09-18T02:00:00.000Z"),
      ]).map((item) => item.id),
    ).toEqual(["notification:n1", "lifecycle:e1", "task:t1"]);
  });

  it("bounds page size", () => {
    expect(parseObjectActivityPageSize(undefined)).toBe(20);
    expect(parseObjectActivityPageSize("100")).toBe(100);
    expect(() => parseObjectActivityPageSize("101")).toThrow(
      "VALIDATION_RANGE",
    );
  });
});
