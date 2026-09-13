import { describe, expect, it } from "vitest";
import {
  decodeCompensationCursor,
  encodeCompensationCursor,
} from "./compensation-page";

describe("compensation cursor", () => {
  it("往返编码", () => {
    const cursor = {
      tenantId: "t1",
      originalClientOperationId: "op-1",
      createdAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "cmp-1",
    };
    expect(decodeCompensationCursor(encodeCompensationCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("损坏 cursor 拒绝", () => {
    expect(() => decodeCompensationCursor("not-base64")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});
