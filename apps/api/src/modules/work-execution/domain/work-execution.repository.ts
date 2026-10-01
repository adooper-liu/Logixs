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
import type { WorkOrderFactDecision } from "./work-order-fact-application";

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

export interface WorkOrderFactApplicationRecord {
  id: string;
  workOrderId: string;
  businessFactKey: string;
  requestHash: string;
  decision: "applied" | "rejected" | "no_op";
  decisionReason: string | null;
  previousState: WorkOrderState;
  resultingState: WorkOrderState;
}

export interface ApplyLifecycleFactReconciliationInput {
  taskId: string;
  resultingTaskState: NodeTaskState;
  factApplication: {
    id: string;
    tenantId: string;
    workOrderId: string;
    canonicalEventId: string;
    nodeInstanceId: string;
    businessFactType: string;
    businessFactKey: string;
    domainFactId: string;
    captureSource: string;
    evidenceRefs: string[];
    occurredAt: Date;
    receivedAt: Date;
    recordedAt: Date;
    requestHash: string;
    decision: WorkOrderFactDecision;
    appliedAt: Date;
    actorOrServiceId: string;
    traceId: string;
  };
  workOrderUpdate: {
    id: string;
    expectedVersion: number;
    previousState: WorkOrderState;
    resultingState: WorkOrderState;
    completedAt: Date;
  } | null;
  taskUpdate: {
    id: string;
    expectedVersion: number;
    previousState: NodeTaskState;
    resultingState: NodeTaskState;
  } | null;
  outcome: (NodeTaskOutcomeDraft & { id: string; evaluatedAt: Date }) | null;
}

export type ApplyLifecycleFactReconciliationResult =
  | {
      kind: "committed";
      factApplication: WorkOrderFactApplicationRecord;
      taskState: NodeTaskState;
      outcomeId: string | null;
    }
  | { kind: "duplicate"; existing: WorkOrderFactApplicationRecord }
  | { kind: "version_conflict" };

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

// 写端口在事务内重验 tenant 与「工单 -> 任务」父链；任一不命中整笔回滚并报 scope_mismatch。
export interface ApplyWorkOrderClaimInput {
  tenantId: string;
  workOrderId: string;
  workOrderState: WorkOrderState;
  assignmentState: AssignmentState;
  assigneeId: string;
  taskId: string;
  taskState: NodeTaskState;
  clientOperation?: ClientOperationRecord;
}

export type ApplyWorkOrderClaimResult =
  { kind: "applied" } | { kind: "state_conflict" } | { kind: "scope_mismatch" };

export interface ApplyWorkOrderCompletionInput {
  tenantId: string;
  workOrderId: string;
  expectedWorkOrderVersion: number;
  workOrderState: WorkOrderState;
  completedAt: Date;
  taskId: string;
  expectedTaskVersion: number;
  taskState: NodeTaskState;
  outcome: NodeTaskOutcomeDraft | null;
  clientOperation?: ClientOperationRecord;
}

export type ApplyWorkOrderCompletionResult =
  | { kind: "applied" }
  | { kind: "version_conflict" }
  | { kind: "scope_mismatch" };

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

export interface TenantScopedTaskQuery {
  tenantId: string;
  taskId: string;
}

export interface TenantScopedWorkOrderQuery {
  tenantId: string;
  workOrderId: string;
}

export interface WorkExecutionRepository {
  findTaskById(id: string): Promise<NodeTaskWithWorkOrders | null>;
  /** 面向用户的读取：租户不符与不存在同样返回 null，不加载他租户聚合。 */
  findTaskInTenant(
    query: TenantScopedTaskQuery,
  ): Promise<NodeTaskWithWorkOrders | null>;
  findTaskByNodeInstanceId(
    nodeInstanceId: string,
  ): Promise<NodeTaskWithWorkOrders | null>;
  findWorkOrderById(id: string): Promise<WorkOrderRecord | null>;
  /** 工单无自有租户列，经所属 NodeTask 限定租户。 */
  findWorkOrderInTenant(
    query: TenantScopedWorkOrderQuery,
  ): Promise<WorkOrderRecord | null>;
  findWorkOrderFactApplication(
    workOrderId: string,
    businessFactKey: string,
  ): Promise<WorkOrderFactApplicationRecord | null>;
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
  applyWorkOrderClaim(
    input: ApplyWorkOrderClaimInput,
  ): Promise<ApplyWorkOrderClaimResult>;
  applyWorkOrderCompletion(
    input: ApplyWorkOrderCompletionInput,
  ): Promise<ApplyWorkOrderCompletionResult>;
  applyLifecycleFactReconciliation(
    input: ApplyLifecycleFactReconciliationInput,
  ): Promise<ApplyLifecycleFactReconciliationResult>;
}
