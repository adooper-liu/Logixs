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
  aggregateNodeTaskState,
  decideNodeTaskTransition,
  decideWorkOrderCompletion,
} from "../domain/state-rules";
import { parseEvidenceRefs } from "../domain/evidence-refs";
import { decideTaskOutcome, resultPolicyForNode } from "../domain/task-outcome";
import {
  WORK_EXECUTION_REPOSITORY,
  type NodeTaskRecord,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

const APPLY_LIFECYCLE_EVENT = Symbol.for("logix.ApplyLifecycleEvent");
const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");
const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}

interface AssertEvidenceRefsPort {
  execute(input: {
    tenantId: string;
    subjectType: string;
    subjectId: string;
    evidenceIds: string[];
  }): Promise<void>;
}

interface ApplyLifecycleEventPort {
  execute(input: {
    containerId: string;
    tenantId: string;
    eventCode: string;
    occurredAt: Date;
    idempotencyKey: string;
    evidenceRefs: string[];
  }): Promise<{
    applied: boolean;
    activatedNodeCode?: string | null;
    activatedNodeTaskId?: string | null;
  }>;
}

export type LifecycleApplyStatus =
  "not_applicable" | "applied" | "replayed" | "rejected" | "skipped";

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
}

@Injectable()
export class CompleteWorkOrderService {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(APPLY_LIFECYCLE_EVENT)
    private readonly applyLifecycleEvent: ApplyLifecycleEventPort,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
  ) {}

  async execute(
    workOrderId: string,
    tenantId: string,
    evidenceRefs: string[] = [],
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
      await this.requireEventEvidence(
        bundle.task,
        bundle.task.state,
        tenantId,
        evidenceRefs,
      );
      const lifecycle = await this.requestLifecycleEvent(
        bundle.task,
        tenantId,
        evidenceRefs,
      );
      return {
        workOrderId,
        workOrderState: workOrder.state,
        taskId: bundle.task.id,
        taskState: bundle.task.state,
        applied: false,
        outcomeRecorded: false,
        ...lifecycle,
      };
    }

    const nextWorkOrders = bundle.workOrders.map((item) =>
      item.id === workOrderId ? { ...item, state: "completed" as const } : item,
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
    const outcome = decideTaskOutcome({
      previousState: bundle.task.state,
      nextState: nextTaskState,
      nodeCode: bundle.task.nodeCode,
      workOrders: nextWorkOrders,
    });

    await this.requireEventEvidence(
      bundle.task,
      nextTaskState,
      tenantId,
      evidenceRefs,
    );

    await this.repository.applyWorkOrderCompletion({
      workOrderId,
      workOrderState: "completed",
      completedAt: new Date(),
      taskId: bundle.task.id,
      taskState: nextTaskState,
      outcome,
    });

    const lifecycle = await this.requestLifecycleEvent(
      {
        ...bundle.task,
        state: nextTaskState,
      },
      tenantId,
      evidenceRefs,
    );

    return {
      workOrderId,
      workOrderState: "completed",
      taskId: bundle.task.id,
      taskState: nextTaskState,
      applied: true,
      outcomeRecorded: outcome !== null,
      ...lifecycle,
    };
  }

  private async requireEventEvidence(
    task: NodeTaskRecord,
    nextTaskState: NodeTaskState,
    tenantId: string,
    evidenceRefs: string[],
  ): Promise<void> {
    const policy = resultPolicyForNode(task.nodeCode);
    if (policy.mode !== "emit_canonical_event") return;
    if (nextTaskState !== "completed" || !task.containerId) return;

    let refs: string[];
    try {
      refs = parseEvidenceRefs(evidenceRefs);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "EVIDENCE_REQUIRED";
      throw new HttpException(
        message,
        message.startsWith("EVIDENCE_REQUIRED")
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertEvidenceRefs.execute({
      tenantId,
      subjectType: "container",
      subjectId: task.containerId,
      evidenceIds: refs,
    });
  }

  private async requestLifecycleEvent(
    task: NodeTaskRecord,
    tenantId: string,
    evidenceRefs: string[],
  ): Promise<{
    lifecycleApply: LifecycleApplyStatus;
    lifecycleEventCode: CanonicalEventCode | null;
    lifecycleDetail: string | null;
    activatedNodeCode: string | null;
    activatedNodeTaskId: string | null;
  }> {
    const idle = {
      activatedNodeCode: null as string | null,
      activatedNodeTaskId: null as string | null,
    };
    const policy = resultPolicyForNode(task.nodeCode);
    if (policy.mode !== "emit_canonical_event" || !policy.eventCode) {
      return {
        lifecycleApply: "not_applicable",
        lifecycleEventCode: null,
        lifecycleDetail: null,
        ...idle,
      };
    }
    if (task.state !== "completed") {
      return {
        lifecycleApply: "not_applicable",
        lifecycleEventCode: policy.eventCode,
        lifecycleDetail: null,
        ...idle,
      };
    }
    if (!task.containerId) {
      return {
        lifecycleApply: "skipped",
        lifecycleEventCode: policy.eventCode,
        lifecycleDetail: "MISSING_CONTAINER_ID",
        ...idle,
      };
    }

    try {
      const result = await this.applyLifecycleEvent.execute({
        containerId: task.containerId,
        tenantId,
        eventCode: policy.eventCode,
        occurredAt: new Date(),
        idempotencyKey: `work-execution:outcome:${task.id}:${policy.eventCode}`,
        evidenceRefs,
      });
      return {
        lifecycleApply: result.applied ? "applied" : "replayed",
        lifecycleEventCode: policy.eventCode,
        lifecycleDetail: null,
        activatedNodeCode: result.activatedNodeCode ?? null,
        activatedNodeTaskId: result.activatedNodeTaskId ?? null,
      };
    } catch (error) {
      return {
        lifecycleApply: "rejected",
        lifecycleEventCode: policy.eventCode,
        lifecycleDetail:
          error instanceof Error ? error.message : "LIFECYCLE_APPLY_FAILED",
        ...idle,
      };
    }
  }
}
