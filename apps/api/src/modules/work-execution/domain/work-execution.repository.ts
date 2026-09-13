import type {
  AssignmentState,
  LifecycleNodeCode,
  NodeTaskState,
  WorkOrderState,
} from "@logix/contracts";
import type { NodeTaskOutcomeDraft } from "./task-outcome";

export const WORK_EXECUTION_REPOSITORY = Symbol("WorkExecutionRepository");

export interface NodeTaskRecord {
  id: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  containerId: string | null;
  taskDefinitionKey: string;
  state: NodeTaskState;
  createdAt: Date;
}

export interface WorkOrderRecord {
  id: string;
  nodeTaskId: string;
  workOrderDefinitionKey: string;
  state: WorkOrderState;
  assignmentState: AssignmentState;
  completedAt: Date | null;
}

export interface NodeTaskOutcomeRecord extends NodeTaskOutcomeDraft {
  id: string;
  evaluatedAt: Date;
}

export interface NodeTaskWithWorkOrders {
  task: NodeTaskRecord;
  workOrders: WorkOrderRecord[];
  outcome: NodeTaskOutcomeRecord | null;
}

export interface CreateTaskInput {
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  containerId: string | null;
  taskDefinitionKey: string;
  workOrderDefinitionKey: string;
}

export interface ApplyWorkOrderCompletionInput {
  workOrderId: string;
  workOrderState: WorkOrderState;
  completedAt: Date;
  taskId: string;
  taskState: NodeTaskState;
  outcome: NodeTaskOutcomeDraft | null;
}

export interface ListTasksByContainerInput {
  containerId: string;
  after?: { createdAt: Date; id: string };
  take: number;
}

export interface WorkExecutionRepository {
  findTaskById(id: string): Promise<NodeTaskWithWorkOrders | null>;
  findTaskByNodeInstanceId(
    nodeInstanceId: string,
  ): Promise<NodeTaskWithWorkOrders | null>;
  findWorkOrderById(id: string): Promise<WorkOrderRecord | null>;
  listTasksByContainer(
    input: ListTasksByContainerInput,
  ): Promise<NodeTaskWithWorkOrders[]>;
  createTaskWithRequiredWorkOrder(
    input: CreateTaskInput,
  ): Promise<NodeTaskWithWorkOrders>;
  applyWorkOrderCompletion(input: ApplyWorkOrderCompletionInput): Promise<void>;
}
