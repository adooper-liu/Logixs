import { describe, expect, it } from "vitest";
import { decodeTaskCursor, encodeTaskCursor, parsePageSize } from "./task-page";

describe("parsePageSize", () => {
  it("缺省为 50，拒绝越界和非整数", () => {
    expect(parsePageSize(undefined)).toBe(50);
    expect(parsePageSize("")).toBe(50);
    expect(parsePageSize("20")).toBe(20);
    expect(() => parsePageSize("0")).toThrow("VALIDATION_FORMAT");
    expect(() => parsePageSize("201")).toThrow("VALIDATION_FORMAT");
    expect(() => parsePageSize("1.5")).toThrow("VALIDATION_FORMAT");
  });
});

describe("task cursor", () => {
  it("编解码往返", () => {
    const cursor = {
      containerId: "c1",
      createdAt: new Date("2026-09-12T10:00:00.000Z"),
      id: "t1",
    };
    expect(decodeTaskCursor(encodeTaskCursor(cursor))).toEqual(cursor);
  });

  it("损坏的 cursor 明确失败", () => {
    expect(() => decodeTaskCursor("not-a-cursor")).toThrow("VALIDATION_FORMAT");
  });
});
