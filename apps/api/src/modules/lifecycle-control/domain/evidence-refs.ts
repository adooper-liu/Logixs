const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEvidenceRefs(refs: string[] | undefined): string[] {
  const evidenceRefs = refs ?? [];
  if (evidenceRefs.length === 0) {
    throw new Error("EVIDENCE_REQUIRED: 缺少合格证据");
  }
  const unique = new Set(evidenceRefs);
  if (unique.size !== evidenceRefs.length) {
    throw new Error("VALIDATION_FORMAT: evidenceRefs 必须唯一");
  }
  if (evidenceRefs.some((ref) => !UUID_PATTERN.test(ref))) {
    throw new Error("VALIDATION_FORMAT: evidenceRefs 含非法 UUID");
  }
  return evidenceRefs;
}
