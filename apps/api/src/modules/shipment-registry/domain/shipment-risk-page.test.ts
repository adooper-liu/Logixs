import { describe, expect, it } from "vitest";
import {
  decodeShipmentRiskCursor,
  encodeShipmentRiskCursor,
  parseShipmentRiskSort,
  SHIPMENT_RISK_QUEUE_CURSOR_SCOPE,
} from "./shipment-risk-page";

const TENANT = "11111111-1111-4111-8111-111111111111";
const ID = "33333333-3333-4333-8333-333333333333";
const AT = new Date("2026-09-28T09:00:00Z");

describe("parseShipmentRiskSort", () => {
  it("不传时用默认排序：离最近约束", () => {
    expect(parseShipmentRiskSort(undefined)).toBe("nearest_deadline");
    expect(parseShipmentRiskSort("")).toBe("nearest_deadline");
  });

  it.each(["nearest_deadline", "eta", "task_due", "updated_at"] as const)(
    "接受可选项：%s",
    (value) => {
      expect(parseShipmentRiskSort(value)).toBe(value);
    },
  );

  it("拒绝免用箱期——它留了位置但不可选，免得让人以为系统在盯免箱期", () => {
    expect(() => parseShipmentRiskSort("free_time")).toThrow(
      /VALIDATION_FORMAT: sort/,
    );
  });

  it("拒绝未知排序键，不静默退回默认值", () => {
    expect(() => parseShipmentRiskSort("eta_desc")).toThrow(
      /VALIDATION_FORMAT: sort/,
    );
  });
});

describe("shipment risk cursor", () => {
  it("原样往返，含排序键与排序值", () => {
    const cursor = {
      tenantId: TENANT,
      sort: "eta" as const,
      sortValue: AT,
      id: ID,
    };

    expect(decodeShipmentRiskCursor(encodeShipmentRiskCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("没有截止的票排序值为 null，也能往返", () => {
    const cursor = {
      tenantId: TENANT,
      sort: "nearest_deadline" as const,
      sortValue: null,
      id: ID,
    };

    expect(decodeShipmentRiskCursor(encodeShipmentRiskCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("记着它属于哪个游标用途，别的用途解不开", () => {
    const raw = encodeShipmentRiskCursor({
      tenantId: TENANT,
      sort: "eta",
      sortValue: AT,
      id: ID,
    });

    expect(JSON.parse(Buffer.from(raw, "base64url").toString())).toEqual(
      expect.objectContaining({
        permissionScope: SHIPMENT_RISK_QUEUE_CURSOR_SCOPE,
      }),
    );
    expect(() => decodeShipmentRiskCursor(raw, "另一个用途")).toThrow(
      /VALIDATION_FORMAT: cursor/,
    );
  });

  it.each([
    ["不是 base64 的乱码", "!!!not-base64!!!"],
    ["base64 但不是 JSON", Buffer.from("nope").toString("base64url")],
    [
      "缺 id",
      Buffer.from(
        JSON.stringify({
          tenantId: TENANT,
          permissionScope: SHIPMENT_RISK_QUEUE_CURSOR_SCOPE,
          sort: "eta",
          sortValue: AT.toISOString(),
        }),
      ).toString("base64url"),
    ],
    [
      "排序值不是时间",
      Buffer.from(
        JSON.stringify({
          tenantId: TENANT,
          permissionScope: SHIPMENT_RISK_QUEUE_CURSOR_SCOPE,
          sort: "eta",
          sortValue: "昨天",
          id: ID,
        }),
      ).toString("base64url"),
    ],
  ])("解不开的游标明确失败：%s", (_label, value) => {
    expect(() => decodeShipmentRiskCursor(value)).toThrow(
      /VALIDATION_FORMAT: cursor/,
    );
  });
});
