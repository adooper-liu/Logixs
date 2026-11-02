import { describe, expect, it } from "vitest";
import {
  FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS,
  validateExternalOceanReferenceMappings,
} from "../../../../../../database/seeds/external-ocean-reference-mappings";

describe("external ocean reference mappings", () => {
  it("keeps supplier values separate from the Logix canonical release", () => {
    const mappings = validateExternalOceanReferenceMappings(
      FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS,
    );
    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "freightower",
          datasetCode: "carrier",
          sourceCode: "MEDU",
          canonicalCode: "MSC",
          mappingState: "candidate",
        }),
      ]),
    );
    expect(
      mappings.every((mapping) => mapping.mappingState !== "confirmed"),
    ).toBe(true);
  });

  it("rejects mappings that point to no canonical or duplicate the same version", () => {
    expect(() =>
      validateExternalOceanReferenceMappings([
        {
          ...FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS[0]!,
          canonicalCode: null,
        },
      ]),
    ).toThrow("canonicalCode");
    expect(() =>
      validateExternalOceanReferenceMappings([
        FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS[0]!,
        FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS[0]!,
      ]),
    ).toThrow("duplicate mapping");
  });
});
