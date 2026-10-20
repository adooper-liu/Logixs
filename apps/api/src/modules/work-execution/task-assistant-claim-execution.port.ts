import type {
  AssignmentState,
  BusinessDecisionState,
  CommitState,
  NodeApplicability,
  NodeTaskState,
  TaskReadinessState,
  ReceptionState,
  WorkOrderApplicability,
  WorkOrderState,
} from "@logix/contracts";

export const TASK_ASSISTANT_CLAIM_EXECUTION = Symbol.for(
  "logix.TaskAssistantClaimExecution",
);

export interface TaskAssistantClaimSnapshot {
  tenantId: string;
  subjectRef: { kind: "container"; id: string };
  task: {
    id: string;
    version: number;
    state: NodeTaskState;
    applicability: NodeApplicability;
    readinessState: TaskReadinessState;
  };
  workOrder: {
    id: string;
    version: number;
    state: WorkOrderState;
    applicability: WorkOrderApplicability;
    assignmentState: AssignmentState;
    assigneeId: string | null;
  } | null;
  nextAction: {
    actionCode:
      "work_execution.claim_work_order" | "work_execution.complete_work_order";
    workOrderId: string;
  } | null;
}

export interface TaskAssistantClaimResult {
  workOrderId: string;
  workOrderState: WorkOrderState;
  assignmentState: AssignmentState;
  assigneeId: string | null;
  taskId: string;
  taskState: NodeTaskState;
  applied: boolean;
  clientOperationId: string;
  traceId: string;
  receptionState: ReceptionState;
  businessDecisionState: BusinessDecisionState;
  commitState: CommitState;
  rejectionReasonCode: string | null;
}

export interface TaskAssistantClaimExecutionPort {
  resolve(input: {
    tenantId: string;
    taskId: string;
    subjectRef: { kind: "container"; id: string };
    workOrderId?: string;
  }): Promise<TaskAssistantClaimSnapshot | null>;
  claim(input: {
    tenantId: string;
    actorId: string;
    workOrderId: string;
    idempotencyKey: string;
    traceId: string;
  }): Promise<TaskAssistantClaimResult>;
  findClaimReceipt(input: {
    tenantId: string;
    actorId: string;
    workOrderId: string;
    idempotencyKey: string;
  }): Promise<TaskAssistantClaimResult | null>;
}
