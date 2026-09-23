import { createHash } from "node:crypto";

export const POST_DEPARTURE_FLOW_DEFINITION_CODE = "post_departure_ocean";
export const POST_DEPARTURE_FLOW_DEFINITION_VERSION = 1;
export const POST_DEPARTURE_LIFECYCLE_EVENT_TYPE =
  "shipment.lifecycle_initialization_requested";
export const POST_DEPARTURE_LIFECYCLE_EVENT_VERSION = 2;

export function canonicalizePostDepartureLifecycleCommand(command) {
  return JSON.stringify(sortJson(command));
}

export function hashPostDepartureLifecycleCommand(command) {
  return createHash("sha256")
    .update(canonicalizePostDepartureLifecycleCommand(command), "utf8")
    .digest("hex");
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
