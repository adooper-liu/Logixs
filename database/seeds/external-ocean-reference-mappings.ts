export interface ExternalOceanReferenceMapping {
  provider: "freightower";
  providerVersion: string;
  datasetCode: "carrier" | "container_type" | "port";
  sourceCode: string;
  canonicalCode: string | null;
  mappingState: "candidate" | "confirmed" | "rejected";
  reason: string;
}

export const FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS: ExternalOceanReferenceMapping[] =
  [
    // Historical draft compatibility; current imports use provider-profiles/*.json.
    {
      provider: "freightower",
      providerVersion: "container-api-reference-2026-10-29",
      datasetCode: "carrier",
      sourceCode: "MEDU",
      canonicalCode: "MSC",
      mappingState: "candidate",
      reason: "SCAC候选映射，待独立复核",
    },
    {
      provider: "freightower",
      providerVersion: "container-api-reference-2026-10-29",
      datasetCode: "port",
      sourceCode: "CNFOC",
      canonicalCode: "CNFOC",
      mappingState: "candidate",
      reason: "供应商港区代码与现有UN/LOCODE候选匹配，待复核",
    },
  ];

export function validateExternalOceanReferenceMappings(
  mappings: ExternalOceanReferenceMapping[],
): ExternalOceanReferenceMapping[] {
  const keys = new Set<string>();
  for (const mapping of mappings) {
    if (!mapping.sourceCode.trim()) throw new Error("sourceCode");
    if (!mapping.canonicalCode?.trim()) throw new Error("canonicalCode");
    const key = `${mapping.provider}:${mapping.providerVersion}:${mapping.datasetCode}:${mapping.sourceCode}`;
    if (keys.has(key)) throw new Error(`duplicate mapping:${key}`);
    keys.add(key);
    if (mapping.mappingState === "confirmed")
      throw new Error("external mapping confirmation requires separate review");
  }
  return mappings;
}

validateExternalOceanReferenceMappings(FREIGHTOWER_OCEAN_REFERENCE_MAPPINGS);
