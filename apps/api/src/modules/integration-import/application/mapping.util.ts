import type { ImportMappingSuggestion } from "../domain/import-batch";

// 从映射建议里找某个标准字段对应的列头。
export function columnForField(
  suggestions: ImportMappingSuggestion[],
  fieldCode: string,
): string | null {
  const suggestion = suggestions.find((s) => s.fieldCode === fieldCode);
  return suggestion?.column ?? null;
}
