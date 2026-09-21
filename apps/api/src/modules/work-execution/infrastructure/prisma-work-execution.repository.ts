import { Inject, Injectable } from "@nestjs/common";
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
import { PrismaService } from "../../../prisma/prisma.service";
import { clientOperationCreateData } from "./client-operation-persist";
import type {
  ApplyWorkOrderClaimInput,
  ApplyWorkOrderCompletionInput,
  CreateTaskInput,
  NodeTaskOutcomeRecord,
  NodeTaskRecord,
  NodeTaskWithWorkOrders,
  WorkExecutionRepository,
  WorkOrderRecord,
} from "../domain/work-execution.repository";
import type { NodeTaskOutcomeDraft } from "../domain/task-outcome";
import type { WorkActivityOperation } from "../domain/object-task-activity";
import {
  WORK_CLAIM_ACTION,
  WORK_COMPLETE_ACTION,
} from "../domain/client-operation";

@Injectable()
export class PrismaWorkExecutionRepository implements WorkExecutionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findTaskById(id: string): Promise<NodeTaskWithWorkOrders | null> {
    return this.loadTask({ id });
  }

  findTaskByNodeInstanceId(
    nodeInstanceId: string,
  ): Promise<NodeTaskWithWorkOrders | null> {
    return this.loadTask({ nodeInstanceId });
  }

  async findWorkOrderById(id: string): Promise<WorkOrderRecord | null> {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id },
    });
    return workOrder ? mapWorkOrder(workOrder) : null;
  }

  async listTasksByContainer(input: {
    containerId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<NodeTaskWithWorkOrders[]> {
    const tasks = await this.prisma.nodeTask.findMany({
      where: {
        containerId: input.containerId,
        ...(input.after
          ? {
              OR: [
                { createdAt: { gt: input.after.createdAt } },
                {
                  AND: [
                    { createdAt: input.after.createdAt },
                    { id: { gt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: { workOrders: true, outcome: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.take,
    });
    return tasks.map((task) => ({
      task: mapTask(task),
      workOrders: task.workOrders.map(mapWorkOrder),
      outcome: task.outcome ? mapOutcome(task.outcome) : null,
    }));
  }

  async listTasksByTenant(input: {
    tenantId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<NodeTaskWithWorkOrders[]> {
    const tasks = await this.prisma.nodeTask.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.after
          ? {
              OR: [
                { createdAt: { gt: input.after.createdAt } },
                {
                  AND: [
                    { createdAt: input.after.createdAt },
                    { id: { gt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: { workOrders: true, outcome: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.take,
    });
    return tasks.map((task) => ({
      task: mapTask(task),
      workOrders: task.workOrders.map(mapWorkOrder),
      outcome: task.outcome ? mapOutcome(task.outcome) : null,
    }));
  }

  async listCommittedWorkActivityOperations(input: {
    tenantId: string;
    workOrderIds: string[];
    atOrBefore: Date;
    take: number;
  }): Promise<WorkActivityOperation[]> {
    if (input.workOrderIds.length === 0) return [];
    const rows = await this.prisma.clientOperation.findMany({
      where: {
        tenantId: input.tenantId,
        targetId: { in: input.workOrderIds },
        actionCode: { in: [WORK_CLAIM_ACTION, WORK_COMPLETE_ACTION] },
        commitState: "committed",
        committedAt: { not: null, lte: input.atOrBefore },
      },
      orderBy: [{ committedAt: "desc" }, { id: "desc" }],
      take: input.take,
      select: {
        id: true,
        actionCode: true,
        targetId: true,
        actorId: true,
        committedAt: true,
        createdAt: true,
      },
    });
    return rows.flatMap((row) =>
      row.committedAt
        ? [
            {
              id: row.id,
              actionCode: row.actionCode,
              targetId: row.targetId,
              actorId: row.actorId,
              committedAt: row.committedAt,
              recordedAt: row.createdAt,
            },
          ]
        : [],
    );
  }

  async upsertTaskWithRequiredWorkOrder(
    input: CreateTaskInput,
  ): Promise<NodeTaskWithWorkOrders> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.nodeTask.findUnique({
        where: { nodeInstanceId: input.nodeInstanceId },
        include: { workOrders: true, outcome: true },
      });
      if (existing) {
        const readinessState =
          existing.readinessState === "ready" ||
          input.readinessState === "ready"
            ? "ready"
            : "waiting_conditions";
        const completionEligibility =
          existing.completionEligibility === "eligible" ||
          input.completionEligibility === "eligible"
            ? "eligible"
            : "awaiting_evidence";
        const conditionFactRefs = [
          ...new Set([
            ...asStringArray(existing.conditionFactRefs),
            ...input.conditionFactRefs,
          ]),
        ];
        const task = await tx.nodeTask.update({
          where: { id: existing.id },
          data: {
            containerId: input.containerId ?? existing.containerId,
            applicability: input.applicability,
            readinessState,
            completionEligibility,
            conditionFactRefs,
            version: { increment: 1 },
          },
        });
        if (readinessState === "ready") {
          await tx.workOrder.updateMany({
            where: { nodeTaskId: task.id, state: "draft" },
            data: { state: "ready", version: { increment: 1 } },
          });
        }
        const workOrders = await tx.workOrder.findMany({
          where: { nodeTaskId: task.id },
        });
        return {
          task: mapTask(task),
          workOrders: workOrders.map(mapWorkOrder),
          outcome: existing.outcome ? mapOutcome(existing.outcome) : null,
        };
      }

      const task = await tx.nodeTask.create({
        data: {
          tenantId: input.tenantId,
          flowInstanceId: input.flowInstanceId,
          nodeInstanceId: input.nodeInstanceId,
          nodeCode: input.nodeCode,
          containerId: input.containerId,
          taskDefinitionKey: input.taskDefinitionKey,
          state: "pending",
          applicability: input.applicability,
          readinessState: input.readinessState,
          completionEligibility: input.completionEligibility,
          version: 0,
          conditionFactRefs: input.conditionFactRefs,
        },
      });
      const workOrder = await tx.workOrder.create({
        data: {
          nodeTaskId: task.id,
          workOrderDefinitionKey: input.workOrderDefinitionKey,
          state: input.readinessState === "ready" ? "ready" : "draft",
          applicability: "required",
          assignmentState: "unassigned",
          version: 0,
        },
      });
      return {
        task: mapTask(task),
        workOrders: [mapWorkOrder(workOrder)],
        outcome: null,
      };
    });
  }

  async applyWorkOrderClaim(input: ApplyWorkOrderClaimInput): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workOrder.updateMany({
        where: {
          id: input.workOrderId,
          assignmentState: { in: ["unassigned", "pool"] },
          state: { in: ["ready", "reopened", "in_progress"] },
        },
        data: {
          state: input.workOrderState,
          assignmentState: input.assignmentState,
          assigneeId: input.assigneeId,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return false;
      await tx.nodeTask.update({
        where: { id: input.taskId },
        data: { state: input.taskState, version: { increment: 1 } },
      });
      if (input.clientOperation) {
        await tx.clientOperation.create({
          data: clientOperationCreateData(input.clientOperation),
        });
      }
      return true;
    });
  }

  async applyWorkOrderCompletion(
    input: ApplyWorkOrderCompletionInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: input.workOrderId },
        data: {
          state: input.workOrderState,
          completedAt: input.completedAt,
          version: { increment: 1 },
        },
      });
      await tx.nodeTask.update({
        where: { id: input.taskId },
        data: { state: input.taskState, version: { increment: 1 } },
      });
      if (input.outcome) {
        await tx.nodeTaskOutcome.create({
          data: {
            nodeTaskId: input.taskId,
            previousState: input.outcome.previousState,
            nextState: input.outcome.nextState,
            resultPolicyMode: input.outcome.resultPolicyMode,
            eventCode: input.outcome.eventCode,
            policySnapshotHash: input.outcome.policySnapshotHash,
            requiredWorkOrderIds: input.outcome.requiredWorkOrderIds,
            completedWorkOrderIds: input.outcome.completedWorkOrderIds,
            evaluatedFactRefs: input.outcome.evaluatedFactRefs ?? [],
            canonicalEventId: input.outcome.canonicalEventId,
            domainFactId: input.outcome.domainFactId,
            actorOrServiceId: input.outcome.actorOrServiceId,
            traceId: input.outcome.traceId,
            evaluatedAt: input.completedAt,
          },
        });
      }
      if (input.clientOperation) {
        await tx.clientOperation.create({
          data: clientOperationCreateData(input.clientOperation),
        });
      }
    });
  }

  private async loadTask(
    where: { id: string } | { nodeInstanceId: string },
  ): Promise<NodeTaskWithWorkOrders | null> {
    const task = await this.prisma.nodeTask.findUnique({
      where,
      include: { workOrders: true, outcome: true },
    });
    if (!task) return null;
    return {
      task: mapTask(task),
      workOrders: task.workOrders.map(mapWorkOrder),
      outcome: task.outcome ? mapOutcome(task.outcome) : null,
    };
  }
}

function mapTask(task: {
  id: string;
  tenantId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: string;
  containerId: string | null;
  taskDefinitionKey: string;
  state: string;
  applicability: string;
  readinessState: string;
  completionEligibility: string;
  conditionFactRefs: unknown;
  version: number;
  createdAt: Date;
}): NodeTaskRecord {
  return {
    id: task.id,
    tenantId: task.tenantId,
    flowInstanceId: task.flowInstanceId,
    nodeInstanceId: task.nodeInstanceId,
    nodeCode: task.nodeCode as LifecycleNodeCode,
    containerId: task.containerId,
    taskDefinitionKey: task.taskDefinitionKey,
    state: task.state as NodeTaskState,
    applicability: task.applicability as NodeApplicability,
    readinessState: task.readinessState as TaskReadinessState,
    completionEligibility:
      task.completionEligibility as TaskCompletionEligibility,
    conditionFactRefs: asStringArray(task.conditionFactRefs),
    version: task.version,
    createdAt: task.createdAt,
  };
}

function mapWorkOrder(workOrder: {
  id: string;
  nodeTaskId: string;
  workOrderDefinitionKey: string;
  state: string;
  applicability: string;
  assignmentState: string;
  assigneeId?: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
}): WorkOrderRecord {
  return {
    id: workOrder.id,
    nodeTaskId: workOrder.nodeTaskId,
    workOrderDefinitionKey: workOrder.workOrderDefinitionKey,
    state: workOrder.state as WorkOrderState,
    applicability: workOrder.applicability as WorkOrderApplicability,
    assignmentState: workOrder.assignmentState as AssignmentState,
    assigneeId: workOrder.assigneeId ?? null,
    dueAt: workOrder.dueAt,
    completedAt: workOrder.completedAt,
    version: workOrder.version,
    createdAt: workOrder.createdAt,
  };
}

function mapOutcome(outcome: {
  id: string;
  previousState: string;
  nextState: string;
  resultPolicyMode: string;
  eventCode: string | null;
  policySnapshotHash: string;
  requiredWorkOrderIds: unknown;
  completedWorkOrderIds: unknown;
  evaluatedFactRefs: unknown;
  canonicalEventId: string | null;
  domainFactId: string | null;
  actorOrServiceId: string | null;
  traceId: string | null;
  evaluatedAt: Date;
}): NodeTaskOutcomeRecord {
  return {
    id: outcome.id,
    previousState:
      outcome.previousState as NodeTaskOutcomeDraft["previousState"],
    nextState: outcome.nextState as NodeTaskOutcomeDraft["nextState"],
    resultPolicyMode:
      outcome.resultPolicyMode as NodeTaskOutcomeDraft["resultPolicyMode"],
    eventCode: outcome.eventCode as NodeTaskOutcomeDraft["eventCode"],
    policySnapshotHash: outcome.policySnapshotHash,
    requiredWorkOrderIds: asStringArray(outcome.requiredWorkOrderIds),
    completedWorkOrderIds: asStringArray(outcome.completedWorkOrderIds),
    evaluatedFactRefs: asStringArray(outcome.evaluatedFactRefs),
    ...(outcome.canonicalEventId
      ? { canonicalEventId: outcome.canonicalEventId }
      : {}),
    ...(outcome.domainFactId ? { domainFactId: outcome.domainFactId } : {}),
    ...(outcome.actorOrServiceId
      ? { actorOrServiceId: outcome.actorOrServiceId }
      : {}),
    ...(outcome.traceId ? { traceId: outcome.traceId } : {}),
    evaluatedAt: outcome.evaluatedAt,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}
