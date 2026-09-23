export const ACTION_CODES = Object.freeze({
  recordLifecycleDateFact: "record_lifecycle_date_fact",
});

export const ACTION_CATALOG_VERSION = "1.0.0";

export const ACTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    actionCode: ACTION_CODES.recordLifecycleDateFact,
    actionVersion: 1,
    ownerModule: "lifecycle-control",
    targetEntityTypes: Object.freeze(["container"]),
    requiredCapabilities: Object.freeze(["lifecycle.operate"]),
    riskLevel: "medium",
    confirmationPolicy: "none",
    reviewPolicy: "none",
    evidencePolicyRef: "lifecycle-date-fact-authority-v1",
    allowedStatePredicates: Object.freeze(["lifecycle_flow_active"]),
    businessPreconditionCodes: Object.freeze([
      "date_fact_schema_valid",
      "source_authority_eligible",
    ]),
    idempotencyScope: "tenant_actor_action_target",
    resultPolicy: "append_versioned_date_fact",
  }),
]);

export function findActionDefinition(actionCode) {
  return ACTION_DEFINITIONS.find(
    (definition) => definition.actionCode === actionCode,
  );
}
