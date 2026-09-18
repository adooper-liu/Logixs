import type {
  ObjectTaskActivityRecord,
  TaskNextAction,
} from "./domain/object-task-activity";

export const LIST_OBJECT_TASK_ACTIVITY = Symbol.for(
  "logix.ListObjectTaskActivity",
);

export interface ObjectTaskActivityPageSource {
  activities: ObjectTaskActivityRecord[];
  nextActions: TaskNextAction[];
  targets: ObjectTaskTarget[];
}

export interface ObjectTaskTarget {
  containerId: string;
  taskId: string;
  workOrderId: string | null;
}

export interface ListObjectTaskActivityPort {
  execute(input: {
    tenantId: string;
    containerId: string;
    atOrBefore: Date;
    take: number;
  }): Promise<ObjectTaskActivityPageSource>;
  resolveTarget(input: {
    tenantId: string;
    containerId: string;
    taskId: string;
    workOrderId?: string | null;
  }): Promise<ObjectTaskTarget | null>;
}
