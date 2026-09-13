import { describe, expect, it } from "vitest";
import {
  decodeContainerCursor,
  encodeContainerCursor,
  parsePageSize,
} from "./container-page";

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

describe("container cursor", () => {
  it("编解码往返", () => {
    const cursor = {
      tenantId: "dev-tenant",
      updatedAt: new Date("2026-09-12T10:00:00.000Z"),
      id: "c1",
    };
    expect(decodeContainerCursor(encodeContainerCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("损坏的 cursor 明确失败", () => {
    expect(() => decodeContainerCursor("not-a-cursor")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});
