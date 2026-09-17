const MIXED_LAYOUT_WINDOW_ROWS = 10;

interface ImportLayoutRow {
  rowNo: number;
  values: Record<string, string>;
}

export interface MixedLayoutLocation {
  rowNo: number;
  worksheetRowNo: number;
}

export function detectMixedLayout(
  headers: string[],
  rows: ImportLayoutRow[],
): MixedLayoutLocation | null {
  const normalizedHeaders = new Set(
    headers
      .filter((header) => !header.startsWith("column_"))
      .map(normalizeLayoutLabel),
  );
  const maxSparseCells = Math.max(4, Math.ceil(headers.length * 0.2));
  const candidates = rows.filter((row) =>
    isMixedLayoutCandidate(
      headers.map((header) => row.values[header] ?? ""),
      normalizedHeaders,
      maxSparseCells,
    ),
  );

  for (let index = 0; index < candidates.length - 1; index += 1) {
    const candidate = candidates[index];
    if (
      candidates[index + 1].rowNo - candidate.rowNo <=
      MIXED_LAYOUT_WINDOW_ROWS
    ) {
      return {
        rowNo: candidate.rowNo,
        worksheetRowNo: candidate.rowNo + 1,
      };
    }
  }
  return null;
}

function normalizeLayoutLabel(value: string): string {
  return value.trim().toLowerCase();
}

function isMixedLayoutCandidate(
  cellValues: string[],
  normalizedHeaders: Set<string>,
  maxSparseCells: number,
): boolean {
  const nonEmpty = cellValues.filter(Boolean);
  if (nonEmpty.length < 2 || nonEmpty.length > maxSparseCells) return false;

  const headerLabelCount = nonEmpty.filter((value) =>
    normalizedHeaders.has(normalizeLayoutLabel(value)),
  ).length;
  return headerLabelCount >= 2;
}
