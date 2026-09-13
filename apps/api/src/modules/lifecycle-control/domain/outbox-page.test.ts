import { describe, expect, it } from "vitest";
import {
  decodeDeadLetterCursor,
  encodeDeadLetterCursor,
  parsePageSize,
} from "./outbox-page";

describe("parsePageSize", () => {
  it("默认 50，拒绝越界", () => {
    expect(parsePageSize(undefined)).toBe(50);
    expect(parsePageSize("10")).toBe(10);
    expect(() => parsePageSize("0")).toThrow("VALIDATION_FORMAT");
    expect(() => parsePageSize("201")).toThrow("VALIDATION_FORMAT");
    expect(() => parsePageSize("1.5")).toThrow("VALIDATION_FORMAT");
  });
});

describe("dead letter cursor", () => {
  it("编解码往返", () => {
    const cursor = {
      tenantId: "t1",
      deadLetteredAt: new Date("2026-09-13T00:00:00.000Z"),
      id: "dl-1",
    };
    expect(decodeDeadLetterCursor(encodeDeadLetterCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("损坏 cursor 拒绝", () => {
    expect(() => decodeDeadLetterCursor("not-a-cursor")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});
