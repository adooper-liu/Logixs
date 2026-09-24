import { describe, expect, it } from "vitest";
import {
  normalizeLocalDateTimeInput,
  sourceDepartureRawToLocalInput,
  zonedLocalDateTimeToIso,
} from "./postDepartureTime";

describe("zonedLocalDateTimeToIso", () => {
  it("converts a China source-local departure time to UTC", () => {
    expect(zonedLocalDateTimeToIso("2026-09-23T00:00", "Asia/Shanghai")).toBe(
      "2026-09-22T16:00:00.000Z",
    );
  });

  it("rejects offset labels and nonexistent DST times", () => {
    expect(() => zonedLocalDateTimeToIso("2026-09-23T00:00", "GMT+8")).toThrow(
      "请选择来源所在地时区",
    );
    expect(() =>
      zonedLocalDateTimeToIso("2026-03-08T02:30", "America/New_York"),
    ).toThrow("该时间在所选时区不存在");
  });

  it("preserves a source-local midnight without shifting it to the prior minute", () => {
    expect(sourceDepartureRawToLocalInput("9/22/2026 00:00:00")).toBe(
      "2026-09-22T00:00",
    );
    expect(sourceDepartureRawToLocalInput("2026-09-22 00:00:00")).toBe(
      "2026-09-22T00:00",
    );
  });

  it("normalizes browser datetime values with zero seconds and milliseconds", () => {
    expect(normalizeLocalDateTimeInput("2026-09-22T23:59:00.000")).toBe(
      "2026-09-22T23:59",
    );
    expect(
      zonedLocalDateTimeToIso("2026-09-22T23:59:00.125", "Asia/Shanghai"),
    ).toBe("2026-09-22T15:59:00.125Z");
  });
});
