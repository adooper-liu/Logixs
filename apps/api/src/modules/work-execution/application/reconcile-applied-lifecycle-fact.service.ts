import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  type ReconcileAppliedLifecycleFactCommand,
  type ReconcileAppliedLifecycleFactPort,
  type ReconcileAppliedLifecycleFactResult,
} from "../reconcile-applied-lifecycle-fact.port";
import {
  WORK_EXECUTION_REPOSITORY,
  type NodeTaskWithWorkOrders,
  type WorkExecutionRepository,
  type WorkOrderFactApplicationRecord,
  type WorkOrderRecord,
} from "../domain/work-execution.repository";
import {
  decideExistingFactApplication,
  decideWorkOrderFactApplication,
  hashAppliedLifecycleWorkFact,
  lifecycleWorkBusinessFactKey,
  type WorkOrderFactDecision,
} from "../domain/work-order-fact-application";
import {
  aggregateNodeTaskState,
  decideNodeTaskTransition,
} from "../domain/state-rules";
import { decideTaskOutcome } from "../domain/task-outcome";

const MAX_VERSION_RETRIES = 3;

@Injectable()
export class ReconcileAppliedLifecycleFactService implements ReconcileAppliedLifecycleFactPort {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
  ) {}

  async execute(
    command: ReconcileAppliedLifecycleFactCommand,
  ): Promise<ReconcileAppliedLifecycleFactResult> {
    validateCommand(command);
    let bundle = await this.repository.findTaskByNodeInstanceId(
      command.nodeInstanceId,
    );
    if (!bundle) return taskNotInitialized();
    assertTaskScope(command, bundle);

    const businessFactKey = lifecycleWorkBusinessFactKey(command);
    const requestHash = hashAppliedLifecycleWorkFact(command);

    for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt += 1) {
      const workOrder = resolveFirstSliceWorkOrder(bundle);
      if (!workOrder) {
        return {
          nodeTaskId: bundle.task.id,
          factApplicationIds: [],
          decision: "rejected",
          taskState: bundle.task.state,
          outcomeId: bundle.outcome?.id ?? null,
          reasonCode: "WORK_ORDER_DEFINITION_UNRESOLVED",
        };
      }

      const existing = await this.repository.findWorkOrderFactApplication(
        workOrder.id,
        businessFactKey,
      );
      if (existing) {
        bundle = await this.reloadTask(command);
        return replayResult(existing, requestHash, bundle);
      }

      const workOrderDecision = decideFactApplication(bundle, workOrder);
      const projectedWorkOrders = bundle.workOrders.map((candidate) =>
        candidate.id === workOrder.id
          ? { ...candidate, state: workOrderDecision.resultingState }
          : candidate,
      );
      const aggregateState = aggregateNodeTaskState(projectedWorkOrders);
      const taskTransition = decideNodeTaskTransition(
        bundle.task.state,
        aggregateState,
      );
      if (taskTransition.kind === "reject") {
        throw conflict(taskTransition.code);
      }
      const resultingTaskState =
        taskTransition.kind === "apply"
          ? (taskTransition.next as typeof bundle.task.state)
          : bundle.task.state;
      const factApplicationId = randomUUID();
      const now = new Date(Math.max(Date.now(), command.receivedAt.getTime()));
      const outcomeDraft = decideTaskOutcome({
        previousState: bundle.task.state,
        nextState: resultingTaskState,
        nodeCode: bundle.task.nodeCode,
        workOrders: projectedWorkOrders
          .filter((candidate) => candidate.applicability === "required")
          .map(({ id, state }) => ({ id, state })),
        factCausation: {
          factApplicationIds: [factApplicationId],
          canonicalEventId: command.canonicalEventId,
          eventCode: command.eventCode,
          domainFactId: command.domainFactId,
          actorOrServiceId: command.actorOrServiceId,
          traceId: command.traceId,
        },
      });
      const outcome = outcomeDraft
        ? { ...outcomeDraft, id: randomUUID(), evaluatedAt: now }
        : null;
      const persisted = await this.repository.applyLifecycleFactReconciliation({
        taskId: bundle.task.id,
        resultingTaskState,
        factApplication: {
          id: factApplicationId,
          tenantId: command.tenantId,
          workOrderId: workOrder.id,
          canonicalEventId: command.canonicalEventId,
          nodeInstanceId: command.nodeInstanceId,
          businessFactType: command.businessFactType,
          businessFactKey,
          domainFactId: command.domainFactId,
          captureSource: command.captureSource,
          evidenceRefs: normalizeRefs(command.evidenceRefs),
          occurredAt: command.occurredAt,
          receivedAt: command.receivedAt,
          recordedAt: now,
          requestHash,
          decision: workOrderDecision,
          appliedAt: now,
          actorOrServiceId: command.actorOrServiceId,
          traceId: command.traceId,
        },
        workOrderUpdate:
          workOrderDecision.resultingState === workOrder.state
            ? null
            : {
                id: workOrder.id,
                expectedVersion: workOrder.version,
                previousState: workOrder.state,
                resultingState: workOrderDecision.resultingState,
                completedAt: command.occurredAt,
              },
        taskUpdate:
          resultingTaskState === bundle.task.state
            ? null
            : {
                id: bundle.task.id,
                expectedVersion: bundle.task.version,
                previousState: bundle.task.state,
                resultingState: resultingTaskState,
              },
        outcome,
      });

      if (persisted.kind === "committed") {
        return {
          nodeTaskId: bundle.task.id,
          factApplicationIds: [persisted.factApplication.id],
          decision: persisted.factApplication.decision,
          taskState: persisted.taskState,
          outcomeId: persisted.outcomeId,
          reasonCode: persisted.factApplication.decisionReason,
        };
      }
      if (persisted.kind === "duplicate") {
        bundle = await this.reloadTask(command);
        return replayResult(persisted.existing, requestHash, bundle);
      }

      bundle = await this.repository.findTaskByNodeInstanceId(
        command.nodeInstanceId,
      );
      if (!bundle) return taskNotInitialized();
      assertTaskScope(command, bundle);
    }

    throw conflict("CONCURRENCY_VERSION_CONFLICT");
  }

  private async reloadTask(
    command: ReconcileAppliedLifecycleFactCommand,
  ): Promise<NodeTaskWithWorkOrders> {
    const bundle = await this.repository.findTaskByNodeInstanceId(
      command.nodeInstanceId,
    );
    if (!bundle) throw conflict("FACT_CAUSATION_MISMATCH");
    assertTaskScope(command, bundle);
    return bundle;
  }
}

function validateCommand(command: ReconcileAppliedLifecycleFactCommand): void {
  const required = [
    command.tenantId,
    command.containerId,
    command.flowInstanceId,
    command.nodeInstanceId,
    command.nodeCode,
    command.canonicalEventId,
    command.eventCode,
    command.domainFactId,
    command.actorOrServiceId,
    command.traceId,
    command.idempotencyKey,
  ];
  if (required.some((value) => !value.trim())) {
    throw new HttpException("VALIDATION_FORMAT", HttpStatus.BAD_REQUEST);
  }
  if (
    !Number.isFinite(command.occurredAt.getTime()) ||
    !Number.isFinite(command.receivedAt.getTime()) ||
    command.receivedAt < command.occurredAt
  ) {
    throw new HttpException("VALIDATION_TIME", HttpStatus.BAD_REQUEST);
  }
  if (
    command.businessFactType === "canonical_lifecycle_event" &&
    command.domainFactId !== command.canonicalEventId
  ) {
    throw conflict("FACT_CAUSATION_MISMATCH");
  }
}

function assertTaskScope(
  command: ReconcileAppliedLifecycleFactCommand,
  bundle: NodeTaskWithWorkOrders,
): void {
  if (bundle.task.tenantId !== command.tenantId) {
    throw new HttpException("AUTHORIZATION_SCOPE_DENIED", HttpStatus.FORBIDDEN);
  }
  if (
    bundle.task.containerId !== command.containerId ||
    bundle.task.flowInstanceId !== command.flowInstanceId ||
    bundle.task.nodeInstanceId !== command.nodeInstanceId ||
    bundle.task.nodeCode !== command.nodeCode
  ) {
    throw conflict("FACT_CAUSATION_MISMATCH");
  }
}

function resolveFirstSliceWorkOrder(
  bundle: NodeTaskWithWorkOrders,
): WorkOrderRecord | null {
  const expectedTaskDefinition = `node-${bundle.task.nodeCode}`;
  const expectedWorkOrderDefinition = `wo-${bundle.task.nodeCode}`;
  const required = bundle.workOrders.filter(
    (workOrder) => workOrder.applicability === "required",
  );
  const hasConditionalRequired = bundle.workOrders.some(
    (workOrder) => workOrder.applicability === "conditional_required",
  );
  const workOrder = required[0];
  if (
    bundle.task.taskDefinitionKey !== expectedTaskDefinition ||
    required.length !== 1 ||
    hasConditionalRequired ||
    !workOrder ||
    workOrder.workOrderDefinitionKey !== expectedWorkOrderDefinition
  ) {
    return null;
  }
  return workOrder;
}

function decideFactApplication(
  bundle: NodeTaskWithWorkOrders,
  workOrder: WorkOrderRecord,
): WorkOrderFactDecision {
  if (bundle.task.state === "cancelled") {
    return {
      decision: "rejected",
      reasonCode: "NODE_TASK_CANCELLED",
      previousState: workOrder.state,
      resultingState: workOrder.state,
    };
  }
  return decideWorkOrderFactApplication(workOrder.state);
}

function replayResult(
  existing: WorkOrderFactApplicationRecord,
  requestHash: string,
  bundle: NodeTaskWithWorkOrders,
): ReconcileAppliedLifecycleFactResult {
  if (
    decideExistingFactApplication(existing.requestHash, requestHash) ===
    "conflict"
  ) {
    throw conflict("IDEMPOTENCY_CONFLICT");
  }
  return {
    nodeTaskId: bundle.task.id,
    factApplicationIds: [existing.id],
    decision: existing.decision,
    taskState: bundle.task.state,
    outcomeId: bundle.outcome?.id ?? null,
    reasonCode: existing.decisionReason,
  };
}

function taskNotInitialized(): ReconcileAppliedLifecycleFactResult {
  return {
    nodeTaskId: null,
    factApplicationIds: [],
    decision: "no_op",
    taskState: null,
    outcomeId: null,
    reasonCode: "TASK_NOT_INITIALIZED",
  };
}

function normalizeRefs(refs: readonly string[]): string[] {
  return [...new Set(refs)].sort();
}

function conflict(code: string): HttpException {
  return new HttpException(code, HttpStatus.CONFLICT);
}
