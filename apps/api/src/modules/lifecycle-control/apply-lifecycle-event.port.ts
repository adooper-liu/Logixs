import type { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";

export const APPLY_LIFECYCLE_EVENT = Symbol.for("logix.ApplyLifecycleEvent");

export type ApplyLifecycleEventPort = Pick<
  ApplyLifecycleEventService,
  "execute"
>;
