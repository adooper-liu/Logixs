import type { LifecycleNodeCode, NodeApplicability } from "@logix/contracts";
import type { TaskConditionFact } from "./domain/task-condition-fact";
import type { NodeTaskWithWorkOrders } from "./domain/work-execution.repository";

export const CREATE_NODE_TASK = Symbol.for("logix.CreateNodeTask");

export type { TaskConditionFact } from "./domain/task-condition-fact";

export interface CreateNodeTaskInput {
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode | string;
  containerId?: string;
  tenantId?: string;
  applicability?: NodeApplicability;
  isCurrent?: boolean;
  conditionFacts?: TaskConditionFact[];
}

export interface CreateNodeTaskPort {
  execute(input: CreateNodeTaskInput): Promise<NodeTaskWithWorkOrders>;
}
