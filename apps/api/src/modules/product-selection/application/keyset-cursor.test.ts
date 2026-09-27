import { describe, expect, it } from "vitest";
import { decodeKeysetCursor, encodeKeysetCursor } from "./keyset-cursor";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const AT = new Date("2026-09-27T00:00:00.000Z");

describe("keyset cursor", () => {
  it("编码后能原样解回，时间精确到毫秒", () => {
    const decoded = decodeKeysetCursor(
      encodeKeysetCursor(TENANT, AT, ID),
      TENANT,
    );

    expect(decoded).toEqual({ at: AT, id: ID });
  });

  it("换一个租户的游标解不开，避免跨租户接着翻别人的页", () => {
    expect(() =>
      decodeKeysetCursor(encodeKeysetCursor(TENANT, AT, ID), OTHER_TENANT),
    ).toThrow(/VALIDATION_FORMAT: cursor/);
  });

  it.each([
    ["不是 base64 的乱码", "!!!not-base64!!!"],
    ["base64 但不是 JSON", Buffer.from("nope").toString("base64url")],
    [
      "缺 id",
      Buffer.from(
        JSON.stringify({ tenantId: TENANT, createdAt: AT.toISOString() }),
      ).toString("base64url"),
    ],
    [
      "时间不是时间",
      Buffer.from(
        JSON.stringify({ tenantId: TENANT, createdAt: "昨天", id: ID }),
      ).toString("base64url"),
    ],
  ])("解不开的游标明确失败：%s", (_label, value) => {
    expect(() => decodeKeysetCursor(value, TENANT)).toThrow(
      /VALIDATION_FORMAT: cursor/,
    );
  });
});
