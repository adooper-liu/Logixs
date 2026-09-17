import type {
  ImportBatch,
  ImportMappingSuggestion,
  ImportReview,
} from "../domain/import-batch";

// 从映射建议里找某个标准字段对应的列头。
export function columnForField(
  mappings: ReadonlyArray<{ column: string; fieldCode: string | null }>,
  fieldCode: string,
): string | null {
  const suggestion = mappings.find((s) => s.fieldCode === fieldCode);
  return suggestion?.column ?? null;
}

export function effectiveMappings(
  batch: ImportBatch,
  reviews: ImportReview[],
): ImportMappingSuggestion[] {
  if (batch.status === "parsed" || reviews.length === 0) return [];
  const latestByColumn = new Map<string, ImportReview>();
  for (const review of reviews) latestByColumn.set(review.column, review);
  return [...latestByColumn.values()].map((review) => ({
    column: review.column,
    fieldCode: review.fieldCode,
    confidence: 1,
  }));
}
