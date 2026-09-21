import type {
  AssignmentState,
  LifecycleNodeCode,
  NodeApplicability,
  NodeTaskState,
  TaskCompletionEligibility,
  TaskReadinessState,
  WorkOrderState,
  WorkOrderApplicability,
} from "@logix/contracts";
import type { ClientOperationRecord } from "./client-operation";
import type { NodeTaskOutcomeDraft } from "./task-outcome";
import type { WorkActivityOperation } from "./object-task-activity";

export const WORK_EXECUTION_REPOSITORY = Symbol("WorkExecutionRepository");

export interface NodeTaskRecord {
  id: string;
  tenantId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  containerId: string | null;
  taskDefinitionKey: string;
  state: NodeTaskState;
  applicability: NodeApplicability;
  readinessState: TaskReadinessState;
  completionEligibility: TaskCompletionEligibility;
  conditionFactRefs: string[];
  version: number;
  createdAt: Date;
}

export interface WorkOrderRecord {
  id: string;
  nodeTaskId: string;
  workOrderDefinitionKey: string;
  state: WorkOrderState;
  applicability: WorkOrderApplicability;
  assignmentState: AssignmentState;
  assigneeId: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
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
  tenantId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  containerId: string | null;
  taskDefinitionKey: string;
  workOrderDefinitionKey: string;
  applicability: NodeApplicability;
  readinessState: TaskReadinessState;
  completionEligibility: TaskCompletionEligibility;
  conditionFactRefs: string[];
}

export interface ApplyWorkOrderClaimInput {
  workOrderId: string;
  workOrderState: WorkOrderState;
  assignmentState: AssignmentState;
  assigneeId: string;
  taskId: string;
  taskState: NodeTaskState;
  clientOperation?: ClientOperationRecord;
}

export interface ApplyWorkOrderCompletionInput {
  workOrderId: string;
  workOrderState: WorkOrderState;
  completedAt: Date;
  taskId: string;
  taskState: NodeTaskState;
  outcome: NodeTaskOutcomeDraft | null;
  clientOperation?: ClientOperationRecord;
}

export interface ListTasksByContainerInput {
  containerId: string;
  after?: { createdAt: Date; id: string };
  take: number;
}

export interface ListTasksByTenantInput {
  tenantId: string;
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
  listTasksByTenant(
    input: ListTasksByTenantInput,
  ): Promise<NodeTaskWithWorkOrders[]>;
  listCommittedWorkActivityOperations(input: {
    tenantId: string;
    workOrderIds: string[];
    atOrBefore: Date;
    take: number;
  }): Promise<WorkActivityOperation[]>;
  upsertTaskWithRequiredWorkOrder(
    input: CreateTaskInput,
  ): Promise<NodeTaskWithWorkOrders>;
  applyWorkOrderClaim(input: ApplyWorkOrderClaimInput): Promise<boolean>;
  applyWorkOrderCompletion(input: ApplyWorkOrderCompletionInput): Promise<void>;
}
