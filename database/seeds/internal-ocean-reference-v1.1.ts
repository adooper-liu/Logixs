import { createHash } from "node:crypto";
import snapshot from "./reference-data/smdg-liner-codes-20261028.json";
import { INTERNAL_CONTAINER_TYPE_REFERENCES } from "./internal-ocean-reference-data";

export const OCEAN_REFERENCE_V11 = {
  id: "00000000-0000-5000-8000-000000000002",
  authority: "Logix",
  datasetCode: "ocean_internal_baseline",
  version: "1.1.0",
  asOf: "2026-10-30",
};

export const CONTAINER_STANDARD_BASIS = {
  codeSystem: "Logix commercial combination code",
  initialBaseline: "Logix ocean_internal_baseline 1.0.0",
  references: [
    {
      publisher: "BIC",
      title: "Size and Type Code",
      url: "https://www.bic-code.org/size-and-type-code/",
      retrievedAt: "2026-10-30",
    },
    {
      publisher: "BIC",
      title: "Type Code Designation",
      url: "https://www.bic-code.org/type-code-designation/",
      retrievedAt: "2026-10-30",
    },
  ],
  standard:
    "ISO 6346 (BIC public guidance; not a reproduction of the ISO standard)",
  scope:
    "Length and commercial category only; full ISO size/type code also requires height, width and detailed equipment characteristics.",
  uniqueIsoEquipmentCode: null,
  limitation:
    "GP/HC/FR/OT/RF do not determine a unique four-character ISO equipment code. No dimensions, tare or load capacity are inferred.",
};

export const INITIAL_LINER_DIRECTORY = snapshot.rows.map((row) => ({
  canonicalCode: row.code,
  nameZh:
    row.code === "MSC" ? "地中海航运" : row.code === "HMM" ? "现代商船" : null,
  nameEn: row.name,
  standardCode: row.code,
  standardVersion: snapshot.source.version,
  sourceUrl: snapshot.source.sourceUrl,
  sourceRow: row.sourceRow,
  parentCode: row.parent,
  isVocc: row.vocc,
  isNvocc: row.nvocc,
  validFrom: row.validFrom,
  validUntil: row.validUntil,
  status: row.status,
  sourceRowHash: row.sourceRowHash,
}));
export const CONTAINER_DIRECTORY_V11 = INTERNAL_CONTAINER_TYPE_REFERENCES.map(
  (row) => ({
    ...row,
    standardBasis: CONTAINER_STANDARD_BASIS,
  }),
);

export function oceanReferenceV11Hash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: snapshot.source,
        carriers: INITIAL_LINER_DIRECTORY,
        containerTypes: CONTAINER_DIRECTORY_V11,
      }),
    )
    .digest("hex");
}
export const SMDG_SOURCE_METADATA = snapshot.source;
