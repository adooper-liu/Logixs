export const PENDING_STATUS = "needs_business_confirmation";

export const STATUS_AUTHORITY = Object.freeze({
  confirmed_business: "business",
  confirmed_contract: "formal_contract",
  confirmed_implementation: "implementation",
});

export const CONFIRMATION_STATUSES = Object.freeze([
  PENDING_STATUS,
  ...Object.keys(STATUS_AUTHORITY),
]);

export const EVIDENCE_SLOT_POLICIES = [
  {
    dimension: "workbench",
    key: "workbenchEvidence",
    appliesTo: ["table", "field"],
    emptyValue: [],
    allowedStatuses: [PENDING_STATUS, "confirmed_business"],
  },
  {
    dimension: "sensitivity",
    key: "sensitivityEvidence",
    appliesTo: ["table", "field"],
    emptyValue: null,
    allowedStatuses: CONFIRMATION_STATUSES,
  },
  ...[
    ["unit", "unitSemantic"],
    ["currency", "currencySemantic"],
    ["timezone", "timezoneSemantic"],
    ["snapshot", "snapshotAttribute"],
    ["version", "versionAttribute"],
    ["audit", "auditAttribute"],
  ].map(([dimension, key]) => ({
    dimension,
    key,
    appliesTo: ["field"],
    emptyValue: null,
    allowedStatuses: CONFIRMATION_STATUSES,
  })),
];

export function evidencePoliciesFor(objectType) {
  return EVIDENCE_SLOT_POLICIES.filter((policy) =>
    policy.appliesTo.includes(objectType),
  );
}

export function pendingDimensions(annotation, objectType) {
  const dimensions = [];
  if (annotation.nameStatus === PENDING_STATUS) dimensions.push("name");
  if (annotation.purposeStatus === PENDING_STATUS) dimensions.push("purpose");
  for (const policy of evidencePoliciesFor(objectType)) {
    if (annotation[policy.key]?.status === PENDING_STATUS) {
      dimensions.push(policy.dimension);
    }
  }
  return dimensions;
}

export function isPendingAnnotation(annotation, objectType) {
  return pendingDimensions(annotation, objectType).length > 0;
}

export function pendingEvidenceSlot(value = null) {
  return {
    value: structuredClone(value),
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
