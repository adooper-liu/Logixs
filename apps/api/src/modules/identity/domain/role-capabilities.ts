/**
 * Minimal role → capability matrix from IDENTITY_ACCESS_MODEL_V1 §5.
 * Roles are capability packs; authorization compares capability codes only.
 */

export type CapabilityCode = string;
export type RoleCode = string;

const ROLE_CAPABILITY_MATRIX: Record<RoleCode, readonly CapabilityCode[]> = {
  field_operator: [
    "container.read",
    "task.read",
    "task.execute",
    "evidence.read",
    "evidence.submit",
    "lifecycle.read",
  ],
  operations_dispatcher: [
    "container.read",
    "task.read",
    "task.execute",
    "evidence.read",
    "evidence.submit",
    "import.read",
    "lifecycle.read",
    "lifecycle.operate",
    "planning.read",
    "planning.draft",
    "charges.read",
    "compliance.read",
    "reliability.read",
    "notification.read",
  ],
  import_operator: [
    "container.read",
    "import.read",
    "import.operate",
    "import.execute",
  ],
  review_supervisor: [
    "container.read",
    "task.read",
    "evidence.read",
    "evidence.review",
    "import.read",
    "lifecycle.read",
    "planning.read",
    "charges.read",
    "compliance.read",
    "compliance.review",
    "compliance.rule.manage",
    "reliability.read",
    "reliability.recover",
    "notification.read",
    "audit.read",
  ],
  finance_controller: [
    "container.read",
    "evidence.read",
    "lifecycle.read",
    "planning.read",
    "charges.read",
    "charges.manage",
    "audit.read",
  ],
  manager: [
    "container.read",
    "task.read",
    "evidence.read",
    "import.read",
    "lifecycle.read",
    "planning.read",
    "charges.read",
    "compliance.read",
    "reliability.read",
    "notification.read",
    "audit.read",
  ],
  business_admin: [
    "container.read",
    "import.read",
    "lifecycle.read",
    "planning.read",
    "charges.read",
    "compliance.read",
    "reliability.read",
    "notification.read",
    "audit.read",
    "identity.manage",
  ],
  audit_analyst: [
    "container.read",
    "task.read",
    "evidence.read",
    "import.read",
    "lifecycle.read",
    "planning.read",
    "charges.read",
    "compliance.read",
    "reliability.read",
    "notification.read",
    "audit.read",
  ],
};

export function capabilitiesForRoles(
  roles: readonly RoleCode[],
): CapabilityCode[] {
  const granted = new Set<CapabilityCode>();
  for (const role of roles) {
    const pack = ROLE_CAPABILITY_MATRIX[role];
    if (!pack) continue;
    for (const capability of pack) granted.add(capability);
  }
  return [...granted].sort();
}

export function hasAllCapabilities(
  granted: readonly CapabilityCode[],
  required: readonly CapabilityCode[],
): boolean {
  if (required.length === 0) return true;
  const set = new Set(granted);
  return required.every((capability) => set.has(capability));
}
