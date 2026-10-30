import { describe, expect, it } from "vitest";
import {
  validateFreightowerReferenceFixture,
  type FreightowerReferenceFixture,
} from "../database/seeds/freightower-reference-data";

const fixture: FreightowerReferenceFixture = {
  sourceUrl: "https://www.freightower.com/help-center/api/container",
  capturedAt: "2026-10-29",
  scope: { carrierRows: 2, portRows: 1, containerTypeRows: 1, carrierCoverageClaim: 97 },
  carriers: [
    { sourceCode: "COSCO", chineseName: "中远", scac: "COSU", apiCarrierCode: "COSCO", booking: true, bill: true, container: true },
    { sourceCode: "EPANASIA", chineseName: "泛亚（内贸）", scac: "COSU", apiCarrierCode: "COSCO", booking: false, bill: true, container: true },
  ],
  ports: [{ sourceCode: "CNFOC", name: "福州港", region: "华南", exportSupported: true, importSupported: true }],
  containerTypes: [{ code: "20GP", size: 20, category: "GP", englishName: "General Purpose" }],
};

describe("Freightower reference fixture", () => {
  it("accepts the captured scope without treating the coverage claim as row completeness", () => {
    expect(validateFreightowerReferenceFixture(fixture)).toEqual({
      carrierCount: 2,
      portCount: 1,
      containerTypeCount: 1,
      scacCollisions: ["COSU"],
      apiCarrierCollisions: ["COSCO"],
    });
  });

  it("rejects AUTO and unsupported carrier parameters as dictionary codes", () => {
    expect(() => validateFreightowerReferenceFixture({
      ...fixture,
      carriers: [{ ...fixture.carriers[0]!, apiCarrierCode: "AUTO" }],
    })).toThrow("AUTO");
    expect(() => validateFreightowerReferenceFixture({
      ...fixture,
      carriers: [{ ...fixture.carriers[0]!, apiCarrierCode: "暂不支持" }],
    })).toThrow("暂不支持");
  });

  it("rejects duplicate source identities and invalid source counts", () => {
    expect(() => validateFreightowerReferenceFixture({
      ...fixture,
      scope: { ...fixture.scope, carrierRows: 49 },
    })).toThrow("carrierRows");
    expect(() => validateFreightowerReferenceFixture({
      ...fixture,
      carriers: [fixture.carriers[0]!, fixture.carriers[0]!],
    })).toThrow("sourceCode");
  });
});
