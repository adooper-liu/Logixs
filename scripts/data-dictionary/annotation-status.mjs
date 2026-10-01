export const PENDING_STATUS = "needs_business_confirmation";

export function isPendingAnnotation(annotation) {
  return (
    annotation.nameStatus === PENDING_STATUS ||
    annotation.purposeStatus === PENDING_STATUS
  );
}

export function pendingEvidenceSlot() {
  return {
    value: null,
    status: PENDING_STATUS,
    sourceRefs: [],
  };
}

export function evidenceSlotText(slot) {
  if (!slot) return "";
  const value = slot.value ?? "待确认";
  const refs = slot.sourceRefs?.length
    ? ` | ${slot.sourceRefs.join(", ")}`
    : "";
  return `${value} | ${slot.status}${refs}`;
}
