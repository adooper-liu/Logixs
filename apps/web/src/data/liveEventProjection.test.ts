import { describe, expect, it } from "vitest";
import { toLiveEvent } from "./liveEventProjection";

describe("toLiveEvent", () => {
  it("只填已落账发生时间，不编造计划或预计", () => {
    const row = toLiveEvent({
      id: "e1",
      containerId: "c1",
      eventCode: "departed",
      occurredAt: "2026-09-13T03:00:00.000Z",
      recordedAt: "2026-09-13T03:01:00.000Z",
      evidenceRefs: ["ev-1"],
    });
    expect(row.label).toBe("离港/离站");
    expect(row.actual).toBe("2026-09-13T03:00:00.000Z");
    expect(row.planned).toBeUndefined();
    expect(row.estimated).toBeUndefined();
    expect(row.evidence).toBe("1 条引用");
    expect(row.eventRef).toBe("e1");
  });
});
