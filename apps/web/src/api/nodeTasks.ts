import { uiCopy } from "../data/uiCopyCatalog";
import { requestJson } from "./httpClient";

// 薄真实任务台 DTO：与 work-execution 控制器响应形状一致。

export interface WorkOrderSummary {
  id: string;
  workOrderDefinitionKey: string;
  state: string;
  assignmentState: string;
  assigneeId: string | null;
  dueAt: string | null;
  completedAt: string | null;
}

export interface NodeTaskNextAction {
  actionCode: string;
  workOrderId: string;
  workOrderDefinitionKey: string;
  assignmentState: string;
  assigneeId: string | null;
  dueAt: string | null;
}

export interface NodeTaskOutcome {
  id: string;
  previousState: string;
  nextState: string;
  resultPolicyMode: string;
  eventCode: string | null;
  requiredWorkOrderIds: string[];
  completedWorkOrderIds: string[];
  evaluatedAt: string;
}

export interface NodeTaskDetail {
  id: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: string;
  containerId: string | null;
  taskDefinitionKey: string;
  state: string;
  applicability: "required" | "optional_applicable" | "optional_not_applicable";
  readinessState: "waiting_conditions" | "ready";
  completionEligibility: "awaiting_evidence" | "eligible";
  conditionFactRefs: string[];
  workOrders: WorkOrderSummary[];
  outcome: NodeTaskOutcome | null;
  nextAction: NodeTaskNextAction | null;
}

export interface NodeTaskPage {
  items: NodeTaskDetail[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

export interface ClaimWorkOrderInput {
  idempotencyKey?: string;
}

export interface ClaimWorkOrderResult {
  workOrderId: string;
  workOrderState: string;
  assignmentState: string;
  assigneeId: string | null;
  taskId: string;
  taskState: string;
  applied: boolean;
  clientOperationId: string;
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  rejectionReasonCode: string | null;
}

export interface CompleteWorkOrderInput {
  evidenceRefs?: string[];
  idempotencyKey?: string;
}

export interface CompleteWorkOrderResult {
  workOrderId: string;
  workOrderState: string;
  taskId: string;
  taskState: string;
  applied: boolean;
  outcomeRecorded: boolean;
  lifecycleApply: string;
  lifecycleEventCode: string | null;
  lifecycleDetail: string | null;
  activatedNodeCode: string | null;
  activatedNodeTaskId: string | null;
  clientOperationId: string;
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  rejectionReasonCode: string | null;
}

export async function listNodeTasks(input?: {
  containerId?: string;
  pageSize?: number;
  cursor?: string;
}): Promise<NodeTaskPage> {
  const query = new URLSearchParams();
  if (input?.containerId) query.set("containerId", input.containerId);
  if (input?.pageSize !== undefined)
    query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  return requestJson<NodeTaskPage>(`/api/node-tasks?${query.toString()}`, {
    fallback: "列节点任务失败",
  });
}

export async function claimWorkOrder(
  workOrderId: string,
  input: ClaimWorkOrderInput = {},
): Promise<ClaimWorkOrderResult> {
  const body: ClaimWorkOrderInput = {};
  if (input.idempotencyKey) body.idempotencyKey = input.idempotencyKey;

  return requestJson<ClaimWorkOrderResult>(
    `/api/work-orders/${workOrderId}/claim`,
    { method: "POST", body, fallback: uiCopy.chrome.claimFailed },
  );
}

export async function completeWorkOrder(
  workOrderId: string,
  input: CompleteWorkOrderInput = {},
): Promise<CompleteWorkOrderResult> {
  const body: CompleteWorkOrderInput = {};
  if (input.evidenceRefs && input.evidenceRefs.length > 0) {
    body.evidenceRefs = input.evidenceRefs;
  }
  if (input.idempotencyKey) body.idempotencyKey = input.idempotencyKey;

  return requestJson<CompleteWorkOrderResult>(
    `/api/work-orders/${workOrderId}/complete`,
    { method: "POST", body, fallback: uiCopy.chrome.completeFailed },
  );
}
