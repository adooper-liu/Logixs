import { describe, expect, it } from "vitest";
import {
  OCEAN_DEMO,
  assertRestoreTarget,
} from "../apps/api/src/modules/ocean-operations/infrastructure/restore-ocean-review-sample";

describe("restore-ocean-review-sample target guard", () => {
  it("accepts only the authorized local database, schema, and tenant", () => {
    expect(
      assertRestoreTarget(
        "postgresql://user:secret@localhost:5433/logix?schema=public",
        OCEAN_DEMO.tenantId,
      ),
    ).toEqual({ database: "logix", schema: "public" });
  });

  it.each([
    [
      "postgresql://user:secret@localhost:5433/other?schema=public",
      OCEAN_DEMO.tenantId,
    ],
    [
      "postgresql://user:secret@localhost:5433/logix?schema=other",
      OCEAN_DEMO.tenantId,
    ],
    [
      "postgresql://user:secret@localhost:5433/logix?schema=public",
      "other-tenant",
    ],
  ])("rejects an unauthorized target", (url, tenantId) => {
    expect(() => assertRestoreTarget(url, tenantId)).toThrow(/OCEAN_DEMO_/);
  });

  it("rejects remote same-name databases and connection redirection parameters", () => {
    for (const url of [
      "postgresql://user:secret@production.example.com:5433/logix?schema=public",
      "postgresql://user:secret@localhost:5433/logix?schema=public&host=production.example.com",
    ])
      expect(() => assertRestoreTarget(url, OCEAN_DEMO.tenantId)).toThrow(
        /OCEAN_DEMO_/,
      );
  });

  it("keeps the business identity and ETA idempotency key deterministic", () => {
    expect(OCEAN_DEMO).toEqual(
      expect.objectContaining({
        tenantId: "demo-real-sample-20260921",
        containerNumber: "MEDU7620177",
        orderNumber: "26DSA01885",
        houseBillNumber: "1811F026PE36668R2",
        etaIdempotencyKey:
          "development-demo:ocean:MEDU7620177:destination-eta:v1",
      }),
    );
  });
});
