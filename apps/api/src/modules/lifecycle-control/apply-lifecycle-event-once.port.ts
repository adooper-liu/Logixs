import type { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";

export const APPLY_LIFECYCLE_EVENT_ONCE = Symbol("ApplyLifecycleEventOnce");

export type ApplyLifecycleEventOncePort = Pick<
  ApplyLifecycleEventService,
  "execute"
>;
