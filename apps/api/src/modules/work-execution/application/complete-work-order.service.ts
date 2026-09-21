import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CanonicalEventCode,
  NodeTaskState,
  WorkOrderState,
} from "@logix/contracts";
import {
  buildBoundaryRejectedClientOperation,
  buildCommittedClientOperation,
  buildRejectedClientOperation,
  decideClientIdempotency,
  hashCompleteRequest,
  parseCompleteIdempotencyKey,
  WORK_COMPLETE_ACTION,
  type ClientOperationRecord,
} from "../domain/client-operation";
import {
  WORK_CLIENT_OPERATION_REPOSITORY,
  type WorkClientOperationRepository,
} from "../domain/client-operation.repository";
import {
  aggregateNodeTaskState,
  decideNodeTaskTransition,
  decideWorkOrderCompletion,
} from "../domain/state-rules";
import { decideTaskOutcome } from "../domain/task-outcome";
import {
  WORK_EXECUTION_REPOSITORY,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}

export type LifecycleApplyStatus =
  "not_applicable" | "applied" | "replayed" | "rejected" | "skipped";

export interface CompleteWorkOrderInput {
  workOrderId: string;
  tenantId: string;
  actorId: string;
  evidenceRefs?: string[];
  idempotencyKey?: string;
  traceId?: string;
}

export interface CompleteWorkOrderResult {
  workOrderId: string;
  workOrderState: WorkOrderState;
  taskId: string;
  taskState: NodeTaskState;
  applied: boolean;
  outcomeRecorded: boolean;
  lifecycleApply: LifecycleApplyStatus;
  lifecycleEventCode: CanonicalEventCode | null;
  lifecycleDetail: string | null;
  activatedNodeCode: string | null;
  activatedNodeTaskId: string | null;
  clientOperationId: string;
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  rejectionReasonCode: string | null;
}

@Injectable()
export class CompleteWorkOrderService {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(WORK_CLIENT_OPERATION_REPOSITORY)
    private readonly operations: WorkClientOperationRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(
    input: CompleteWorkOrderInput,
  ): Promise<CompleteWorkOrderResult> {
    const tenantId = input.tenantId.trim();
    const actorId = input.actorId.trim();
    if (!tenantId || !actorId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }

    let idempotencyKey: string;
    try {
      idempotencyKey = parseCompleteIdempotencyKey(
        input.idempotencyKey,
        input.workOrderId,
      );
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const evidenceRefs = input.evidenceRefs ?? [];
    const requestHash = hashCompleteRequest({
      workOrderId: input.workOrderId,
      evidenceRefs,
    });
    const existing = await this.operations.findByIdempotency({
      tenantId,
      actorId,
      actionCode: WORK_COMPLETE_ACTION,
      idempotencyKey,
    });
    if (existing) {
      if (
        decideClientIdempotency(existing.requestHash, requestHash) ===
        "conflict"
      ) {
        throw new HttpException(
          "IDEMPOTENCY_CONFLICT: 同键异载荷",
          HttpStatus.CONFLICT,
        );
      }
      return this.reuse(existing);
    }

    const now = new Date();
    const base = {
      id: randomUUID(),
      tenantId,
      actorType: "user",
      actorId,
      targetId: input.workOrderId,
      correlationId: randomUUID(),
      traceId: input.traceId?.trim() || randomUUID(),
      idempotencyKey,
      requestHash,
      now,
    };

    try {
      return await this.complete(
        input.workOrderId,
        tenantId,
        evidenceRefs,
        base,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const message = error instanceof HttpException ? error.message : "";
      await this.operations.insert(classifyCompleteFailure(base, message));
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        "INTERNAL_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async reuse(
    existing: ClientOperationRecord,
  ): Promise<CompleteWorkOrderResult> {
    const workOrder = await this.repository.findWorkOrderById(
      existing.targetId,
    );
    if (!workOrder) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const bundle = await this.repository.findTaskById(workOrder.nodeTaskId);
    if (!bundle) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return {
      workOrderId: workOrder.id,
      workOrderState: workOrder.state,
      taskId: bundle.task.id,
      taskState: bundle.task.state,
      applied: false,
      outcomeRecorded: false,
      lifecycleApply: "not_applicable",
      lifecycleEventCode: null,
      lifecycleDetail: null,
      activatedNodeCode: null,
      activatedNodeTaskId: null,
      ...receipt(existing),
    };
  }

  private async complete(
    workOrderId: string,
    tenantId: string,
    evidenceRefs: string[],
    base: Omit<
      Parameters<typeof buildCommittedClientOperation>[0],
      "resultRefs"
    >,
  ): Promise<CompleteWorkOrderResult> {
    const workOrder = await this.repository.findWorkOrderById(workOrderId);
    if (!workOrder) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const bundle = await this.repository.findTaskById(workOrder.nodeTaskId);
    if (!bundle) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (bundle.task.containerId) {
      await this.assertContainerTenant.execute({
        containerId: bundle.task.containerId,
        tenantId,
      });
    }

    const workOrderDecision = decideWorkOrderCompletion(workOrder.state);
    if (workOrderDecision.kind === "reject") {
      throw new HttpException(
        `${workOrderDecision.code}: ${workOrderDecision.message}`,
        HttpStatus.CONFLICT,
      );
    }
    if (workOrderDecision.kind === "already_done") {
      const operation = buildCommittedClientOperation({
        ...base,
        resultRefs: completeResultRefs(
          workOrderId,
          bundle.task.id,
          bundle.task.containerId,
        ),
      });
      await this.operations.insert(operation);
      return {
        workOrderId,
        workOrderState: workOrder.state,
        taskId: bundle.task.id,
        taskState: bundle.task.state,
        applied: false,
        outcomeRecorded: false,
        ...noLifecycleApplication(),
        ...receipt(operation),
      };
    }

    const nextWorkOrders = bundle.workOrders.map((item) =>
      item.id === workOrderId ? { ...item, state: "completed" as const } : item,
    );
    const aggregated = aggregateNodeTaskState(
      nextWorkOrders.map((item) => ({
        state: item.state,
        applicability: item.applicability,
      })),
    );
    const taskDecision = decideNodeTaskTransition(
      bundle.task.state,
      aggregated,
    );
    if (taskDecision.kind === "reject") {
      throw new HttpException(
        `${taskDecision.code}: ${taskDecision.message}`,
        HttpStatus.CONFLICT,
      );
    }

    const nextTaskState =
      taskDecision.kind === "apply"
        ? (taskDecision.next as NodeTaskState)
        : bundle.task.state;
    const outcome = decideTaskOutcome({
      previousState: bundle.task.state,
      nextState: nextTaskState,
      nodeCode: bundle.task.nodeCode,
      workOrders: nextWorkOrders,
    });

    const operation = buildCommittedClientOperation({
      ...base,
      resultRefs: completeResultRefs(
        workOrderId,
        bundle.task.id,
        bundle.task.containerId,
      ),
    });
    await this.repository.applyWorkOrderCompletion({
      workOrderId,
      workOrderState: "completed",
      completedAt: new Date(),
      taskId: bundle.task.id,
      taskState: nextTaskState,
      outcome,
      clientOperation: operation,
    });

    return {
      workOrderId,
      workOrderState: "completed",
      taskId: bundle.task.id,
      taskState: nextTaskState,
      applied: true,
      outcomeRecorded: outcome !== null,
      ...noLifecycleApplication(),
      ...receipt(operation),
    };
  }
}

function noLifecycleApplication(): {
  lifecycleApply: LifecycleApplyStatus;
  lifecycleEventCode: CanonicalEventCode | null;
  lifecycleDetail: string | null;
  activatedNodeCode: null;
  activatedNodeTaskId: null;
} {
  return {
    lifecycleApply: "not_applicable",
    lifecycleEventCode: null,
    lifecycleDetail: null,
    activatedNodeCode: null,
    activatedNodeTaskId: null,
  };
}

function completeResultRefs(
  workOrderId: string,
  taskId: string,
  containerId: string | null,
) {
  return [
    { entityType: "work_order", entityId: workOrderId },
    { entityType: "node_task", entityId: taskId },
    ...(containerId
      ? [{ entityType: "container", entityId: containerId }]
      : []),
  ];
}

function receipt(record: ClientOperationRecord) {
  return {
    clientOperationId: record.id,
    receptionState: record.receptionState,
    businessDecisionState: record.businessDecisionState,
    commitState: record.commitState,
    rejectionReasonCode: record.rejectionReasonCode,
  };
}

function classifyCompleteFailure(
  base: Omit<
    Parameters<typeof buildRejectedClientOperation>[0],
    "rejectionReasonCode"
  >,
  message: string,
): ClientOperationRecord {
  if (
    message.startsWith("AUTHORIZATION_SCOPE_DENIED") ||
    message.startsWith("AUTHENTICATION_REQUIRED")
  ) {
    return buildBoundaryRejectedClientOperation({
      ...base,
      rejectionReasonCode:
        message.split(":")[0] ?? "AUTHORIZATION_SCOPE_DENIED",
    });
  }
  if (message.startsWith("VALIDATION_FORMAT")) {
    return buildBoundaryRejectedClientOperation({
      ...base,
      rejectionReasonCode: "VALIDATION_FORMAT",
    });
  }
  const reason = message.split(":")[0]?.trim() || "BUSINESS_REJECTED";
  return buildRejectedClientOperation({
    ...base,
    rejectionReasonCode: reason,
  });
}
