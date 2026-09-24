import type { ActionDefinition } from "./generated/contracts";

export const ACTION_CODES: Readonly<{
  recordLifecycleDateFact: "record_lifecycle_date_fact";
}>;
export const ACTION_CATALOG_VERSION: "1.0.0";
export const ACTION_DEFINITIONS: readonly ActionDefinition[];
export function findActionDefinition(
  actionCode: string,
): ActionDefinition | undefined;
