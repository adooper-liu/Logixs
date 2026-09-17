import type { ImportRow } from "../domain/import-batch";
import {
  IMPORT_TIME_FACT_CATALOG,
  isCompletedTimeStatus,
  type ImportFieldCode,
  type ImportTimeFactCode,
} from "../domain/import-field-catalog";
import type { EffectiveImportMapping } from "./import-row-mapper";
import { mappedValue } from "./import-row-mapper";

export interface MappedImportTimeFact {
  factCode: ImportTimeFactCode;
  timeKind: "actual" | "estimated";
  captureSource: "controlled_import" | "system_derived";
  eventCode: string | null;
  rawValue: string;
  occurredAtUtc: Date;
  sourceUtcOffset: string;
  sourceSystem: string;
  sourceStatus: string | null;
  evidenceRef: string | null;
  derivationRuleVersion: string | null;
  sourceRowId: string;
}

export function collectImportTimeFacts(
  rows: ImportRow[],
  mappings: EffectiveImportMapping[],
): MappedImportTimeFact[] {
  const facts: MappedImportTimeFact[] = [];
  for (const definition of IMPORT_TIME_FACT_CATALOG) {
    const sourceRow = rows.find(
      (row) => mappedValue(row, mappings, definition.timeFieldCode) !== "",
    );
    if (!sourceRow) continue;

    const rawValue = mappedValue(sourceRow, mappings, definition.timeFieldCode);
    const sourceUtcOffset = mappedValue(
      sourceRow,
      mappings,
      "timeSourceUtcOffset",
    );
    const occurredAtUtc = normalizeSourceDateTime(rawValue, sourceUtcOffset);
    const sourceStatus = definition.statusFieldCode
      ? mappedValue(sourceRow, mappings, definition.statusFieldCode)
      : null;
    const evidenceRef = mappedValue(sourceRow, mappings, "timeEvidenceRef");
    const derivationRuleVersion = mappedValue(
      sourceRow,
      mappings,
      "timeDerivationRuleVersion",
    );

    if (
      !occurredAtUtc ||
      (definition.timeKind === "actual" &&
        (!sourceStatus || !isCompletedTimeStatus(definition, sourceStatus)))
    ) {
      throw new Error("PRECHECK_INVARIANT_VIOLATION");
    }

    facts.push({
      factCode: definition.code,
      timeKind: definition.timeKind,
      captureSource: definition.captureSource,
      eventCode: definition.eventCode,
      rawValue,
      occurredAtUtc,
      sourceUtcOffset: normalizeUtcOffset(sourceUtcOffset) ?? sourceUtcOffset,
      sourceSystem: mappedValue(sourceRow, mappings, "timeSourceSystem"),
      sourceStatus,
      evidenceRef: evidenceRef || null,
      derivationRuleVersion: derivationRuleVersion || null,
      sourceRowId: sourceRow.id,
    });
  }
  return facts;
}

export function mappedTimeValue(
  row: ImportRow,
  mappings: EffectiveImportMapping[],
  fieldCode: ImportFieldCode,
): string {
  return mappedValue(row, mappings, fieldCode);
}

export function normalizeSourceDateTime(
  rawValue: string,
  sourceUtcOffset: string,
): Date | null {
  const offset = normalizeUtcOffset(sourceUtcOffset);
  if (!offset) return null;

  const value = rawValue.trim();
  const iso = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/,
  );
  const slash = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!iso && !slash) return null;

  const parts = iso
    ? {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
        hour: Number(iso[4]),
        minute: Number(iso[5]),
        second: Number(iso[6] ?? "0"),
        millisecond: Number((iso[7] ?? "0").padEnd(3, "0")),
        embeddedOffset: iso[8] ? normalizeUtcOffset(iso[8]) : null,
      }
    : {
        year: Number(slash![3]),
        month: Number(slash![1]),
        day: Number(slash![2]),
        hour: Number(slash![4]),
        minute: Number(slash![5]),
        second: Number(slash![6] ?? "0"),
        millisecond: 0,
        embeddedOffset: null,
      };

  if (parts.embeddedOffset && parts.embeddedOffset !== offset) return null;
  if (!validDateTimeParts(parts)) return null;

  const offsetMinutes = parseOffsetMinutes(offset);
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ) -
      offsetMinutes * 60_000,
  );
}

export function normalizeUtcOffset(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "UTC" || normalized === "Z") return "+00:00";
  const match = normalized.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) {
    return null;
  }
  return `${match[1]}${match[2]}:${match[3]}`;
}

function parseOffsetMinutes(offset: string): number {
  const sign = offset.startsWith("-") ? -1 : 1;
  return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
}

function validDateTimeParts(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}): boolean {
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59 ||
    parts.millisecond < 0 ||
    parts.millisecond > 999
  ) {
    return false;
  }
  return (
    parts.day <= new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate()
  );
}
