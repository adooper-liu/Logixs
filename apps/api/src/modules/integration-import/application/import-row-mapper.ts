import type { ImportBatch, ImportRow } from "../domain/import-batch";
import type {
  ImportFieldCode,
  QuantityUnitCode,
} from "../domain/import-field-catalog";
import { normalizeQuantityUnit } from "../domain/import-field-catalog";
import { columnForField } from "./mapping.util";

export interface EffectiveImportMapping {
  column: string;
  fieldCode: string | null;
}

export interface MappedImportRow {
  sourceRowId: string;
  rowNo: number;
  orderNumber: string;
  containerNumber: string | null;
  productNumber: string;
  shippedQuantity: string;
  quantityUnit: QuantityUnitCode | null;
  contractNumber: string | null;
}

export function mappedValue(
  row: ImportRow,
  mappings: EffectiveImportMapping[],
  fieldCode: ImportFieldCode,
): string {
  const column = columnForField(mappings, fieldCode);
  return column ? (row.values[column] ?? "").trim() : "";
}

export function normalizePositiveDecimal(value: string): string | null {
  const normalized = value.replaceAll(",", "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) return null;
  if (Number(normalized) <= 0 || !Number.isFinite(Number(normalized))) {
    return null;
  }
  return normalized;
}

export function mapImportRow(
  batch: ImportBatch,
  row: ImportRow,
  mappings: EffectiveImportMapping[],
): MappedImportRow {
  const sourceUnit = mappedValue(row, mappings, "quantityUnit");
  return {
    sourceRowId: row.id,
    rowNo: row.rowNo,
    orderNumber: mappedValue(row, mappings, "orderNumber"),
    containerNumber: mappedValue(row, mappings, "containerNumber") || null,
    productNumber: mappedValue(row, mappings, "productNumber"),
    shippedQuantity:
      normalizePositiveDecimal(mappedValue(row, mappings, "shippedQuantity")) ??
      "",
    quantityUnit: normalizeQuantityUnit(
      sourceUnit || batch.confirmedQuantityUnit,
    ),
    contractNumber: mappedValue(row, mappings, "contractNumber") || null,
  };
}
