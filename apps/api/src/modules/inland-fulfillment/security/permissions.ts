/**
 * inland-fulfillment permission declarations (Odoo security/ analogue).
 * Capability codes align with IDENTITY_ACCESS_MODEL_V1.
 */

export const inlandFulfillmentPermissions = [
  {
    capabilityCode: "planning.read",
    resource: "inland_plan",
    actions: ["read"] as const,
    description: "Read inland plans and planning setup projections",
  },
  {
    capabilityCode: "planning.draft",
    resource: "inland_plan",
    actions: ["create", "update"] as const,
    description: "Replace planning setup and draft inland plans",
  },
] as const;

export type InlandFulfillmentPermission =
  (typeof inlandFulfillmentPermissions)[number];
