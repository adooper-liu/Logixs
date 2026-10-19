export const TASK_COLLABORATION_CLOCK = Symbol.for(
  "logix.TaskCollaborationClock",
);

export type TaskCollaborationClock = () => Date;
