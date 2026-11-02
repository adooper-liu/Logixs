import { describe, expect, it } from "vitest";
import {
  INTERNAL_OCEAN_CARRIER_REFERENCES,
  INTERNAL_CONTAINER_TYPE_REFERENCES,
  validateInternalOceanReferenceFixture,
} from "../../../../../../database/seeds/internal-ocean-reference-data";

describe("internal ocean reference baseline", () => {
  it("contains the fixed carrier and container canonical values", () => {
    expect(
      INTERNAL_OCEAN_CARRIER_REFERENCES.map((row) => row.canonicalCode),
    ).toEqual(["MSC", "HMM"]);
    expect(INTERNAL_CONTAINER_TYPE_REFERENCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalCode: "20GP",
          length: 20,
          typeCode: "GP",
        }),
        expect.objectContaining({
          canonicalCode: "40HC",
          length: 40,
          typeCode: "HC",
        }),
        expect.objectContaining({
          canonicalCode: "40RF",
          length: 40,
          typeCode: "RF",
        }),
      ]),
    );
  });

  it("rejects duplicate canonical codes and invalid combinations", () => {
    expect(() =>
      validateInternalOceanReferenceFixture({
        carriers: [
          INTERNAL_OCEAN_CARRIER_REFERENCES[0]!,
          INTERNAL_OCEAN_CARRIER_REFERENCES[0]!,
        ],
        containerTypes: INTERNAL_CONTAINER_TYPE_REFERENCES,
      }),
    ).toThrow("duplicate carrier canonical code");
    expect(() =>
      validateInternalOceanReferenceFixture({
        carriers: INTERNAL_OCEAN_CARRIER_REFERENCES,
        containerTypes: [
          { ...INTERNAL_CONTAINER_TYPE_REFERENCES[0]!, length: 40 },
        ],
      }),
    ).toThrow("container length");
  });
});
