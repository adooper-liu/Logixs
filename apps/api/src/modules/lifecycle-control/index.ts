// lifecycle-control 公开入口：其他模块只消费端口，不得引用内部实现。
export * from "./lifecycle-control.module";
export { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";
export type {
  ApplyLifecycleEventInput,
  ApplyLifecycleEventResult,
} from "./application/apply-lifecycle-event.service";
export {
  APPLY_LIFECYCLE_EVENT,
  type ApplyLifecycleEventPort,
} from "./apply-lifecycle-event.port";
