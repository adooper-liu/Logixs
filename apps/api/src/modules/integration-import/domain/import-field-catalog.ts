import rawCatalog, {
  type ImportFieldCatalog,
  type ImportFieldCode,
  type ImportTimeFactCode,
  type ImportTimeFactDefinition,
  type QuantityUnitCode,
} from "@logix/contracts/import-fields.json";

export type {
  ImportFieldCode,
  ImportTimeFactCode,
  ImportTimeFactDefinition,
  QuantityUnitCode,
};

export const IMPORT_FIELD_CATALOG: ImportFieldCatalog = rawCatalog;
export const IMPORT_TIME_FACT_CATALOG = IMPORT_FIELD_CATALOG.timeFacts;

const fieldCodes = new Set(IMPORT_FIELD_CATALOG.fields.map(({ code }) => code));
const unitsByAlias = new Map(
  IMPORT_FIELD_CATALOG.quantityUnits.flatMap((unit) =>
    unit.aliases.map(
      (alias) => [alias.trim().toLowerCase(), unit.code] as const,
    ),
  ),
);

export function isImportFieldCode(value: string): value is ImportFieldCode {
  return fieldCodes.has(value as ImportFieldCode);
}

export function normalizeQuantityUnit(
  value: string | null | undefined,
): QuantityUnitCode | null {
  if (!value) return null;
  return unitsByAlias.get(value.trim().toLowerCase()) ?? null;
}

export function isCompletedTimeStatus(
  definition: ImportTimeFactDefinition,
  value: string,
): boolean {
  const normalized = value.trim().toLowerCase();
  return definition.completedStatusAliases.some(
    (alias) => alias.trim().toLowerCase() === normalized,
  );
}
