import type { StartPostDepartureLifecycleCommandV2 } from "./index";

export const POST_DEPARTURE_FLOW_DEFINITION_CODE: "post_departure_ocean";
export const POST_DEPARTURE_FLOW_DEFINITION_VERSION: 1;
export const POST_DEPARTURE_LIFECYCLE_EVENT_TYPE: "shipment.lifecycle_initialization_requested";
export const POST_DEPARTURE_LIFECYCLE_EVENT_VERSION: 2;

export function canonicalizePostDepartureLifecycleCommand(
  command: StartPostDepartureLifecycleCommandV2,
): string;

export function hashPostDepartureLifecycleCommand(
  command: StartPostDepartureLifecycleCommandV2,
): string;

export type { StartPostDepartureLifecycleCommandV2 };
