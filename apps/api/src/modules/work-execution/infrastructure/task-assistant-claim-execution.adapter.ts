import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ClaimWorkOrderService } from "../application/claim-work-order.service";
import { projectNextActions } from "../domain/object-task-activity";
import {
  decideClientIdempotency,
  hashClaimRequest,
  WORK_CLAIM_ACTION,
} from "../domain/client-operation";
import {
  WORK_CLIENT_OPERATION_REPOSITORY,
  type WorkClientOperationRepository,
} from "../domain/client-operation.repository";
import {
  WORK_EXECUTION_REPOSITORY,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";
import type {
  TaskAssistantClaimExecutionPort,
  TaskAssistantClaimResult,
  TaskAssistantClaimSnapshot,
} from "../task-assistant-claim-execution.port";

@Injectable()
export class TaskAssistantClaimExecutionAdapter implements TaskAssistantClaimExecutionPort {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(WORK_CLIENT_OPERATION_REPOSITORY)
    private readonly operations: WorkClientOperationRepository,
    private readonly claimWorkOrder: ClaimWorkOrderService,
  ) {}

  async resolve(input: {
    tenantId: string;
    taskId: string;
    subjectRef: { kind: "container"; id: string };
    workOrderId?: string;
  }): Promise<TaskAssistantClaimSnapshot | null> {
    const bundle = await this.repository.findTaskInTenant({
      tenantId: input.tenantId,
      taskId: input.taskId,
    });
    if (!bundle || bundle.task.containerId !== input.subjectRef.id) return null;

    const next = projectNextActions([bundle])[0] ?? null;
    const requestedWorkOrderId = input.workOrderId ?? next?.workOrderId;
    const workOrder = requestedWorkOrderId
      ? (bundle.workOrders.find(({ id }) => id === requestedWorkOrderId) ??
        null)
      : null;

    return {
      tenantId: bundle.task.tenantId,
      subjectRef: { kind: "container", id: input.subjectRef.id },
      task: {
        id: bundle.task.id,
        version: bundle.task.version,
        state: bundle.task.state,
        applicability: bundle.task.applicability,
        readinessState: bundle.task.readinessState,
      },
      workOrder: workOrder
        ? {
            id: workOrder.id,
            version: workOrder.version,
            state: workOrder.state,
            applicability: workOrder.applicability,
            assignmentState: workOrder.assignmentState,
            assigneeId: workOrder.assigneeId,
          }
        : null,
      nextAction: next
        ? { actionCode: next.actionCode, workOrderId: next.workOrderId }
        : null,
    };
  }

  async claim(input: {
    tenantId: string;
    actorId: string;
    workOrderId: string;
    idempotencyKey: string;
    traceId: string;
  }): Promise<TaskAssistantClaimResult> {
    const result = await this.claimWorkOrder.execute(input);
    const operation = await this.findCommittedOperation(input);
    if (!operation || operation.id !== result.clientOperationId) {
      throw new InternalServerErrorException("CLAIM_RECEIPT_NOT_FOUND");
    }
    return {
      ...result,
      traceId: operation.traceId,
      assignmentState:
        result.assignmentState as TaskAssistantClaimResult["assignmentState"],
      receptionState:
        result.receptionState as TaskAssistantClaimResult["receptionState"],
      businessDecisionState:
        result.businessDecisionState as TaskAssistantClaimResult["businessDecisionState"],
      commitState:
        result.commitState as TaskAssistantClaimResult["commitState"],
    };
  }

  async findClaimReceipt(input: {
    tenantId: string;
    actorId: string;
    workOrderId: string;
    idempotencyKey: string;
  }) {
    const operation = await this.findCommittedOperation(input);
    if (!operation) return null;
    const workOrder = await this.repository.findWorkOrderInTenant({
      tenantId: input.tenantId,
      workOrderId: input.workOrderId,
    });
    if (!workOrder) return null;
    const bundle = await this.repository.findTaskInTenant({
      tenantId: input.tenantId,
      taskId: workOrder.nodeTaskId,
    });
    if (!bundle) return null;
    return {
      workOrderId: workOrder.id,
      workOrderState: workOrder.state,
      assignmentState: workOrder.assignmentState,
      assigneeId: workOrder.assigneeId,
      taskId: bundle.task.id,
      taskState: bundle.task.state,
      applied: false,
      clientOperationId: operation.id,
      traceId: operation.traceId,
      receptionState: operation.receptionState,
      businessDecisionState: operation.businessDecisionState,
      commitState: operation.commitState,
      rejectionReasonCode: operation.rejectionReasonCode,
    };
  }

  private async findCommittedOperation(input: {
    tenantId: string;
    actorId: string;
    workOrderId: string;
    idempotencyKey: string;
  }) {
    const operation = await this.operations.findByIdempotency({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actionCode: WORK_CLAIM_ACTION,
      idempotencyKey: input.idempotencyKey,
    });
    if (!operation) return null;
    if (
      decideClientIdempotency(
        operation.requestHash,
        hashClaimRequest({ workOrderId: input.workOrderId }),
      ) === "conflict" ||
      operation.targetId !== input.workOrderId
    ) {
      throw new HttpException("IDEMPOTENCY_CONFLICT", HttpStatus.CONFLICT);
    }
    if (
      operation.businessDecisionState !== "accepted" ||
      operation.commitState !== "committed"
    ) {
      throw new HttpException(
        operation.rejectionReasonCode ?? "BUSINESS_STATE_VIOLATION",
        HttpStatus.CONFLICT,
      );
    }
    return operation;
  }
}
