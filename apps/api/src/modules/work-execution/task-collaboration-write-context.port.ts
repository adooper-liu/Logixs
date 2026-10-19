export const TASK_COLLABORATION_WRITE_CONTEXT = Symbol.for(
  "logix.TaskCollaborationWriteContext",
);

export interface TaskCollaborationWriteTransaction {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

export interface LockedTaskCollaborationContext {
  taskId: string;
  state: string;
  containerId: string;
  assigneeActorIds: string[];
}

export interface TaskCollaborationWriteContextPort {
  lock(
    transaction: TaskCollaborationWriteTransaction,
    input: {
      tenantId: string;
      taskId: string;
      subjectRef: { kind: "container"; id: string };
    },
  ): Promise<LockedTaskCollaborationContext | null>;
}
