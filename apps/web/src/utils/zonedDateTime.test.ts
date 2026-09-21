import { describe, expect, it } from "vitest";
import { parseZonedDateTime } from "./zonedDateTime";

describe("parseZonedDateTime", () => {
  it("converts a destination wall time with its IANA offset", () => {
    const result = parseZonedDateTime(
      "2026-09-21T09:00",
      "America/Los_Angeles",
    );
    expect(result.occurredAt.toISOString()).toBe("2026-09-21T16:00:00.000Z");
    expect(result.sourceUtcOffset).toBe("-07:00");
  });

  it("preserves a non-DST Asia offset", () => {
    const result = parseZonedDateTime("2026-09-21T09:00", "Asia/Shanghai");
    expect(result.occurredAt.toISOString()).toBe("2026-09-21T01:00:00.000Z");
    expect(result.sourceUtcOffset).toBe("+08:00");
  });

  it.each([
    ["2026-03-08T02:30", "不存在"],
    ["2026-11-01T01:30", "重复时段"],
  ])("rejects ambiguous DST wall time %s", (value, message) => {
    expect(() => parseZonedDateTime(value, "America/Los_Angeles")).toThrow(
      message,
    );
  });

  it("rejects an unknown IANA time zone", () => {
    expect(() => parseZonedDateTime("2026-09-21T09:00", "UTC+8")).toThrow(
      "IANA 时区无效",
    );
  });
});
