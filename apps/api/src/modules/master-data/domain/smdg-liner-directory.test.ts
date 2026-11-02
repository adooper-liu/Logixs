import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSmdgWorkbook } from "../../../../../../database/seeds/smdg-liner-directory";

const workbook = resolve(
  __dirname,
  "../../../../../../database/seeds/reference-data/smdg-liner-codes-20261028.xlsx",
);
describe("official SMDG liner directory", () => {
  it("preserves source identities, alphanumeric codes, periods and unknown classifications", async () => {
    const parsed = await parseSmdgWorkbook(
      readFileSync(workbook),
      "2026-10-30",
    );
    expect(parsed.rows).toHaveLength(373);
    expect(parsed.rows.find((row) => row.code === "G2O")?.name).toBe(
      "G2 Ocean AS",
    );
    expect(parsed.rows.find((row) => row.code === "MSC")).toMatchObject({
      name: "Mediterranean Shipping Company",
      vocc: null,
      nvocc: null,
      status: "active",
    });
    expect(parsed.rows.find((row) => row.code === "HMM")).toMatchObject({
      vocc: true,
      status: "active",
    });
    expect(parsed.rows.find((row) => row.code === "AND")).toMatchObject({
      status: "deprecated",
      validUntil: "2020-12-31",
    });
    expect(parsed.rows.find((row) => row.code === "OVS")).toMatchObject({
      status: "active",
      validUntil: "2027-03-21",
    });
    expect(parsed.rows.find((row) => row.code === "TFP")).toMatchObject({
      status: "review_required",
      issues: ["column7:2025-1010"],
    });
    expect(new Set(parsed.rows.map((row) => row.code)).size).toBe(373);
  });
});
