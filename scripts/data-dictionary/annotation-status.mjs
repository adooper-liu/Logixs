export const PENDING_STATUS = "needs_business_confirmation";

export const FIELD_EVIDENCE_DIMENSIONS = [
  ["unit", "unitSemantic"],
  ["currency", "currencySemantic"],
  ["timezone", "timezoneSemantic"],
  ["snapshot", "snapshotAttribute"],
  ["version", "versionAttribute"],
  ["audit", "auditAttribute"],
];

export function pendingDimensions(annotation) {
  const dimensions = [];
  if (annotation.nameStatus === PENDING_STATUS) dimensions.push("name");
  if (annotation.purposeStatus === PENDING_STATUS) dimensions.push("purpose");
  if (annotation.workbenchEvidence?.status === PENDING_STATUS) {
    dimensions.push("workbench");
  }
  if (annotation.sensitivityEvidence?.status === PENDING_STATUS) {
    dimensions.push("sensitivity");
  }
  for (const [dimension, field] of FIELD_EVIDENCE_DIMENSIONS) {
    if (annotation[field]?.status === PENDING_STATUS)
      dimensions.push(dimension);
  }
  return dimensions;
}

export function isPendingAnnotation(annotation) {
  return pendingDimensions(annotation).length > 0;
}

export function pendingEvidenceSlot(value = null) {
  return {
    value,
    status: PENDING_STATUS,
    sourceRefs: [],
  };
}

export function evidenceSlotText(slot) {
  if (!slot) return "";
  const value = Array.isArray(slot.value)
    ? slot.value.join(", ") || "待确认"
    : (slot.value ?? "待确认");
  const refs = slot.sourceRefs?.length
    ? ` | ${slot.sourceRefs.join(", ")}`
    : "";
  return `${value} | ${slot.status}${refs}`;
}
