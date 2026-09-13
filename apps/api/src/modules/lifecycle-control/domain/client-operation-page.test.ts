import { describe, expect, it } from "vitest";
import {
  decodeClientOperationCursor,
  encodeClientOperationCursor,
} from "./client-operation-page";

describe("client-operation cursor", () => {
  it("往返编码", () => {
    const cursor = {
      tenantId: "t1",
      createdAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "op-1",
    };
    expect(
      decodeClientOperationCursor(encodeClientOperationCursor(cursor)),
    ).toEqual(cursor);
  });

  it("损坏 cursor 拒绝", () => {
    expect(() => decodeClientOperationCursor("not-base64")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});
