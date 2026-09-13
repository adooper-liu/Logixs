import type { CreateNodeTaskService } from "./application/create-node-task.service";

export const CREATE_NODE_TASK = Symbol.for("logix.CreateNodeTask");

export type CreateNodeTaskPort = Pick<CreateNodeTaskService, "execute">;
