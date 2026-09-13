export const WORKFLOW_SCHEDULE = Symbol.for("logix.WorkflowSchedule");

export interface WorkflowScheduleSpec {
  scheduleId: string;
  workflowType: string;
  taskQueue: string;
  intervalSeconds: number;
  args: unknown[];
}

export interface WorkflowSchedulePort {
  ensure(spec: WorkflowScheduleSpec): Promise<{ created: boolean }>;
}
