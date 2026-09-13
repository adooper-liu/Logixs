import { describe, expect, it } from "vitest";
import {
  outboxPublishDueScheduleId,
  outboxPublishDueSystemScheduleId,
  parseScheduleIntervalSeconds,
} from "./outbox-publish-schedule";

describe("outboxPublishDueScheduleId", () => {
  it("按租户生成稳定 id，拒绝空租户", () => {
    expect(outboxPublishDueScheduleId(" t1 ")).toBe("outbox-publish-due:t1");
    expect(() => outboxPublishDueScheduleId("  ")).toThrow("VALIDATION_FORMAT");
  });
});

describe("outboxPublishDueSystemScheduleId", () => {
  it("全库只有一条稳定 id", () => {
    expect(outboxPublishDueSystemScheduleId()).toBe(
      "outbox-publish-due-system",
    );
  });
});

describe("parseScheduleIntervalSeconds", () => {
  it("默认 30 秒，拒绝越界与非整数", () => {
    expect(parseScheduleIntervalSeconds(undefined)).toBe(30);
    expect(parseScheduleIntervalSeconds("60")).toBe(60);
    expect(() => parseScheduleIntervalSeconds("4")).toThrow(
      "VALIDATION_FORMAT",
    );
    expect(() => parseScheduleIntervalSeconds("3601")).toThrow(
      "VALIDATION_FORMAT",
    );
    expect(() => parseScheduleIntervalSeconds("1.5")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});
