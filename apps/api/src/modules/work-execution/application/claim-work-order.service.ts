import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { NodeTaskState, WorkOrderState } from "@logix/contracts";
import {
  buildBoundaryRejectedClientOperation,
  buildCommittedClientOperation,
  buildRejectedClientOperation,
  decideClientIdempotency,
  hashClaimRequest,
  parseClaimIdempotencyKey,
  WORK_CLAIM_ACTION,
  type ClientOperationRecord,
} from "../domain/client-operation";
import {
  WORK_CLIENT_OPERATION_REPOSITORY,
  type WorkClientOperationRepository,
} from "../domain/client-operation.repository";
import {
  aggregateNodeTaskState,
  decideNodeTaskTransition,
} from "../domain/state-rules";
import { decideWorkOrderClaim } from "../domain/work-order-claim";
import {
  WORK_EXECUTION_REPOSITORY,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}

export interface ClaimWorkOrderInput {
  workOrderId: string;
  tenantId: string;
  actorId: string;
  idempotencyKey?: string;
  traceId?: string;
}

export interface ClaimWorkOrderResult {
  workOrderId: string;
  workOrderState: WorkOrderState;
  assignmentState: string;
  assigneeId: string | null;
  taskId: string;
  taskState: NodeTaskState;
  applied: boolean;
  clientOperationId: string;
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  rejectionReasonCode: string | null;
}

@Injectable()
export class ClaimWorkOrderService {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(WORK_CLIENT_OPERATION_REPOSITORY)
    private readonly operations: WorkClientOperationRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: ClaimWorkOrderInput): Promise<ClaimWorkOrderResult> {
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
      idempotencyKey = parseClaimIdempotencyKey(
        input.idempotencyKey,
        input.workOrderId,
      );
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const requestHash = hashClaimRequest({ workOrderId: input.workOrderId });
    const existing = await this.operations.findByIdempotency({
      tenantId,
      actorId,
      actionCode: WORK_CLAIM_ACTION,
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
      actionCode: WORK_CLAIM_ACTION,
      targetId: input.workOrderId,
      correlationId: randomUUID(),
      traceId: input.traceId?.trim() || randomUUID(),
      idempotencyKey,
      requestHash,
      now,
    };

    try {
      return await this.claim(input.workOrderId, tenantId, actorId, base);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const message = error instanceof HttpException ? error.message : "";
      await this.operations.insert(classifyClaimFailure(base, message));
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        "INTERNAL_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async reuse(
    existing: ClientOperationRecord,
  ): Promise<ClaimWorkOrderResult> {
    const workOrder = await this.repository.findWorkOrderById(
      existing.targetId,
    );
    if (!workOrder) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const bundle = await this.repository.findTaskById(workOrder.nodeTaskId);
    if (!bundle) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return {
      workOrderId: workOrder.id,
      workOrderState: workOrder.state,
      assignmentState: workOrder.assignmentState,
      assigneeId: workOrder.assigneeId,
      taskId: bundle.task.id,
      taskState: bundle.task.state,
      applied: false,
      ...receipt(existing),
    };
  }

  private async claim(
    workOrderId: string,
    tenantId: string,
    actorId: string,
    base: Omit<
      Parameters<typeof buildCommittedClientOperation>[0],
      "resultRefs"
    >,
  ): Promise<ClaimWorkOrderResult> {
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

    const decision = decideWorkOrderClaim({
      state: workOrder.state,
      assignmentState: workOrder.assignmentState,
      assigneeId: workOrder.assigneeId,
      actorId,
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        HttpStatus.CONFLICT,
      );
    }

    const operation = buildCommittedClientOperation({
      ...base,
      resultRefs: [
        { entityType: "work_order", entityId: workOrderId },
        { entityType: "node_task", entityId: bundle.task.id },
        ...(bundle.task.containerId
          ? [{ entityType: "container", entityId: bundle.task.containerId }]
          : []),
      ],
    });

    if (decision.kind === "already_done") {
      await this.operations.insert(operation);
      return {
        workOrderId,
        workOrderState: workOrder.state,
        assignmentState: workOrder.assignmentState,
        assigneeId: workOrder.assigneeId,
        taskId: bundle.task.id,
        taskState: bundle.task.state,
        applied: false,
        ...receipt(operation),
      };
    }

    const nextWorkOrders = bundle.workOrders.map((item) =>
      item.id === workOrderId
        ? {
            ...item,
            state: decision.nextState,
            assignmentState: decision.assignmentState,
          }
        : item,
    );
    const aggregated = aggregateNodeTaskState(
      nextWorkOrders.map((item) => ({
        state: item.state,
        applicability: "required",
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

    const applied = await this.repository.applyWorkOrderClaim({
      workOrderId,
      workOrderState: decision.nextState,
      assignmentState: decision.assignmentState,
      assigneeId: actorId,
      taskId: bundle.task.id,
      taskState: nextTaskState,
      clientOperation: operation,
    });
    if (!applied) {
      const latest = await this.repository.findWorkOrderById(workOrderId);
      if (!latest) throw new NotFoundException("RESOURCE_NOT_FOUND");
      const retry = decideWorkOrderClaim({
        state: latest.state,
        assignmentState: latest.assignmentState,
        assigneeId: latest.assigneeId,
        actorId,
      });
      if (retry.kind === "already_done") {
        await this.operations.insert(operation);
        return {
          workOrderId,
          workOrderState: latest.state,
          assignmentState: latest.assignmentState,
          assigneeId: latest.assigneeId,
          taskId: bundle.task.id,
          taskState: bundle.task.state,
          applied: false,
          ...receipt(operation),
        };
      }
      throw new HttpException(
        "BUSINESS_STATE_VIOLATION: 工单已被他人领取",
        HttpStatus.CONFLICT,
      );
    }

    return {
      workOrderId,
      workOrderState: decision.nextState,
      assignmentState: decision.assignmentState,
      assigneeId: actorId,
      taskId: bundle.task.id,
      taskState: nextTaskState,
      applied: true,
      ...receipt(operation),
    };
  }
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

function classifyClaimFailure(
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
