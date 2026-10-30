export interface InternalOceanCarrierReference {
  canonicalCode: string;
  nameZh: string;
  nameEn: string;
  status: "active";
}

export interface InternalContainerTypeReference {
  canonicalCode: string;
  length: 20 | 40 | 45;
  typeCode: "GP" | "HC" | "FR" | "OT" | "RF";
  status: "active";
}

export const INTERNAL_OCEAN_CARRIER_REFERENCES: InternalOceanCarrierReference[] =
  [
    {
      canonicalCode: "MSC",
      nameZh: "地中海航运",
      nameEn: "MSC",
      status: "active",
    },
    {
      canonicalCode: "HMM",
      nameZh: "现代商船",
      nameEn: "HMM",
      status: "active",
    },
  ];

export const INTERNAL_CONTAINER_TYPE_REFERENCES: InternalContainerTypeReference[] =
  [
    { canonicalCode: "20GP", length: 20, typeCode: "GP", status: "active" },
    { canonicalCode: "40GP", length: 40, typeCode: "GP", status: "active" },
    { canonicalCode: "45GP", length: 45, typeCode: "GP", status: "active" },
    { canonicalCode: "20HC", length: 20, typeCode: "HC", status: "active" },
    { canonicalCode: "40HC", length: 40, typeCode: "HC", status: "active" },
    { canonicalCode: "45HC", length: 45, typeCode: "HC", status: "active" },
    { canonicalCode: "20FR", length: 20, typeCode: "FR", status: "active" },
    { canonicalCode: "40FR", length: 40, typeCode: "FR", status: "active" },
    { canonicalCode: "20OT", length: 20, typeCode: "OT", status: "active" },
    { canonicalCode: "40OT", length: 40, typeCode: "OT", status: "active" },
    { canonicalCode: "20RF", length: 20, typeCode: "RF", status: "active" },
    { canonicalCode: "40RF", length: 40, typeCode: "RF", status: "active" },
  ];

export function validateInternalOceanReferenceFixture(input: {
  carriers: InternalOceanCarrierReference[];
  containerTypes: InternalContainerTypeReference[];
}): void {
  const carrierCodes = new Set<string>();
  for (const carrier of input.carriers) {
    if (carrierCodes.has(carrier.canonicalCode))
      throw new Error(
        `duplicate carrier canonical code: ${carrier.canonicalCode}`,
      );
    carrierCodes.add(carrier.canonicalCode);
  }
  const containerCodes = new Set<string>();
  for (const containerType of input.containerTypes) {
    if (containerCodes.has(containerType.canonicalCode))
      throw new Error(
        `duplicate container canonical code: ${containerType.canonicalCode}`,
      );
    containerCodes.add(containerType.canonicalCode);
    if (
      `${containerType.length}${containerType.typeCode}` !==
      containerType.canonicalCode
    )
      throw new Error(
        `container length/type does not match: ${containerType.canonicalCode}`,
      );
  }
}

validateInternalOceanReferenceFixture({
  carriers: INTERNAL_OCEAN_CARRIER_REFERENCES,
  containerTypes: INTERNAL_CONTAINER_TYPE_REFERENCES,
});
