// work-execution 公开入口：其他模块只消费端口，不得引用内部实现。
export * from "./work-execution.module";
export { CreateNodeTaskService } from "./application/create-node-task.service";
export {
  CREATE_NODE_TASK,
  type CreateNodeTaskInput,
  type CreateNodeTaskPort,
  type TaskConditionFact,
} from "./create-node-task.port";
export {
  PROJECT_EXTERNAL_WORK_ITEMS,
  type ExternalWorkItemDraft,
  type ProjectExternalWorkItemsCommand,
  type ProjectExternalWorkItemsPort,
  type ProjectExternalWorkItemsResult,
} from "./project-external-work-items.port";
export {
  LIST_OBJECT_TASK_ACTIVITY,
  type ListObjectTaskActivityPort,
  type ObjectTaskActivityPageSource,
  type ObjectTaskTarget,
} from "./list-object-task-activity.port";
