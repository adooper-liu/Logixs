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
import type { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { clientOperationCreateData } from "./client-operation-persist";
import type {
  ApplyWorkOrderClaimInput,
  ApplyWorkOrderClaimResult,
  ApplyWorkOrderCompletionInput,
  ApplyWorkOrderCompletionResult,
  ApplyLifecycleFactReconciliationInput,
  ApplyLifecycleFactReconciliationResult,
  CreateTaskInput,
  NodeTaskOutcomeRecord,
  NodeTaskRecord,
  NodeTaskWithWorkOrders,
  TenantScopedTaskQuery,
  TenantScopedWorkOrderQuery,
  WorkExecutionRepository,
  WorkOrderFactApplicationRecord,
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

  findTaskInTenant(
    query: TenantScopedTaskQuery,
  ): Promise<NodeTaskWithWorkOrders | null> {
    return this.loadTask({ id: query.taskId, tenantId: query.tenantId });
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

  async findWorkOrderInTenant(
    query: TenantScopedWorkOrderQuery,
  ): Promise<WorkOrderRecord | null> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: query.workOrderId,
        nodeTask: { tenantId: query.tenantId },
      },
    });
    return workOrder ? mapWorkOrder(workOrder) : null;
  }

  async findWorkOrderFactApplication(
    workOrderId: string,
    businessFactKey: string,
  ): Promise<WorkOrderFactApplicationRecord | null> {
    const application = await this.prisma.workOrderFactApplication.findUnique({
      where: {
        workOrderId_businessFactKey: { workOrderId, businessFactKey },
      },
    });
    return application ? mapFactApplication(application) : null;
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

  async applyWorkOrderClaim(
    input: ApplyWorkOrderClaimInput,
  ): Promise<ApplyWorkOrderClaimResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scope = workOrderScope(input);
        const updated = await tx.workOrder.updateMany({
          where: {
            ...scope,
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
        if (updated.count === 0) {
          const inScope = await tx.workOrder.count({ where: scope });
          return inScope === 1
            ? { kind: "state_conflict" as const }
            : { kind: "scope_mismatch" as const };
        }
        const task = await tx.nodeTask.updateMany({
          where: { id: input.taskId, tenantId: input.tenantId },
          data: { state: input.taskState, version: { increment: 1 } },
        });
        if (task.count !== 1)
          throw new WorkExecutionWriteRejected("scope_mismatch");
        if (input.clientOperation) {
          await tx.clientOperation.create({
            data: clientOperationCreateData(input.clientOperation),
          });
        }
        return { kind: "applied" as const };
      });
    } catch (error) {
      if (error instanceof WorkExecutionWriteRejected) {
        return { kind: "scope_mismatch" };
      }
      throw error;
    }
  }

  async applyWorkOrderCompletion(
    input: ApplyWorkOrderCompletionInput,
  ): Promise<ApplyWorkOrderCompletionResult> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const scope = workOrderScope(input);
        const workOrder = await tx.workOrder.updateMany({
          where: { ...scope, version: input.expectedWorkOrderVersion },
          data: {
            state: input.workOrderState,
            completedAt: input.completedAt,
            version: { increment: 1 },
          },
        });
        if (workOrder.count !== 1) {
          const inScope = await tx.workOrder.count({ where: scope });
          throw new WorkExecutionWriteRejected(
            inScope === 1 ? "version_conflict" : "scope_mismatch",
          );
        }
        // 任务版本守卫串行化同任务的并发完成，保证聚合与 outcome 基于最新工单集合。
        const taskScope = { id: input.taskId, tenantId: input.tenantId };
        const task = await tx.nodeTask.updateMany({
          where: { ...taskScope, version: input.expectedTaskVersion },
          data: { state: input.taskState, version: { increment: 1 } },
        });
        if (task.count !== 1) {
          const inScope = await tx.nodeTask.count({ where: taskScope });
          throw new WorkExecutionWriteRejected(
            inScope === 1 ? "version_conflict" : "scope_mismatch",
          );
        }
        await this.createCompletionArtifacts(tx, input);
      });
      return { kind: "applied" };
    } catch (error) {
      if (error instanceof WorkExecutionWriteRejected) {
        return { kind: error.kind };
      }
      throw error;
    }
  }

  private async createCompletionArtifacts(
    tx: Prisma.TransactionClient,
    input: ApplyWorkOrderCompletionInput,
  ): Promise<void> {
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
  }

  async applyLifecycleFactReconciliation(
    input: ApplyLifecycleFactReconciliationInput,
  ): Promise<ApplyLifecycleFactReconciliationResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.workOrderFactApplication.findUnique({
            where: {
              workOrderId_businessFactKey: {
                workOrderId: input.factApplication.workOrderId,
                businessFactKey: input.factApplication.businessFactKey,
              },
            },
          });
          if (existing) {
            return {
              kind: "duplicate" as const,
              existing: mapFactApplication(existing),
            };
          }

          if (input.workOrderUpdate) {
            const updated = await tx.workOrder.updateMany({
              where: {
                id: input.workOrderUpdate.id,
                version: input.workOrderUpdate.expectedVersion,
                state: input.workOrderUpdate.previousState,
              },
              data: {
                state: input.workOrderUpdate.resultingState,
                completedAt: input.workOrderUpdate.completedAt,
                version: { increment: 1 },
              },
            });
            if (updated.count !== 1) throw new ReconciliationVersionConflict();
          }

          const decision = input.factApplication.decision;
          const factApplication = await tx.workOrderFactApplication.create({
            data: {
              id: input.factApplication.id,
              tenantId: input.factApplication.tenantId,
              workOrderId: input.factApplication.workOrderId,
              canonicalEventId: input.factApplication.canonicalEventId,
              nodeInstanceId: input.factApplication.nodeInstanceId,
              businessFactType: input.factApplication.businessFactType,
              businessFactKey: input.factApplication.businessFactKey,
              domainFactId: input.factApplication.domainFactId,
              captureSource: input.factApplication.captureSource,
              evidenceRefs: input.factApplication.evidenceRefs,
              occurredAt: input.factApplication.occurredAt,
              receivedAt: input.factApplication.receivedAt,
              recordedAt: input.factApplication.recordedAt,
              requestHash: input.factApplication.requestHash,
              decision: decision.decision,
              decisionReason: decision.reasonCode,
              previousState: decision.previousState,
              resultingState: decision.resultingState,
              appliedAt: input.factApplication.appliedAt,
              actorOrServiceId: input.factApplication.actorOrServiceId,
              traceId: input.factApplication.traceId,
            },
          });

          if (input.taskUpdate) {
            const updated = await tx.nodeTask.updateMany({
              where: {
                id: input.taskUpdate.id,
                version: input.taskUpdate.expectedVersion,
                state: input.taskUpdate.previousState,
              },
              data: {
                state: input.taskUpdate.resultingState,
                version: { increment: 1 },
              },
            });
            if (updated.count !== 1) throw new ReconciliationVersionConflict();
          }

          if (input.outcome) {
            await tx.nodeTaskOutcome.create({
              data: {
                id: input.outcome.id,
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
                evaluatedAt: input.outcome.evaluatedAt,
              },
            });
          }

          return {
            kind: "committed" as const,
            factApplication: mapFactApplication(factApplication),
            taskState: input.resultingTaskState,
            outcomeId: input.outcome?.id ?? null,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof ReconciliationVersionConflict) {
        return { kind: "version_conflict" };
      }
      const code = prismaErrorCode(error);
      if (code === "P2002") {
        const existing = await this.findWorkOrderFactApplication(
          input.factApplication.workOrderId,
          input.factApplication.businessFactKey,
        );
        if (existing) return { kind: "duplicate", existing };
        throw error;
      }
      if (code === "P2034") return { kind: "version_conflict" };
      throw error;
    }
  }

  private async loadTask(
    where:
      | { id: string }
      | { id: string; tenantId: string }
      | { nodeInstanceId: string },
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

class ReconciliationVersionConflict extends Error {}

class WorkExecutionWriteRejected extends Error {
  constructor(readonly kind: "scope_mismatch" | "version_conflict") {
    super(kind);
  }
}

function workOrderScope(input: {
  tenantId: string;
  workOrderId: string;
  taskId: string;
}) {
  return {
    id: input.workOrderId,
    nodeTaskId: input.taskId,
    nodeTask: { tenantId: input.tenantId },
  };
}

function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function mapFactApplication(application: {
  id: string;
  workOrderId: string;
  businessFactKey: string;
  requestHash: string;
  decision: string;
  decisionReason: string | null;
  previousState: string;
  resultingState: string;
}): WorkOrderFactApplicationRecord {
  return {
    id: application.id,
    workOrderId: application.workOrderId,
    businessFactKey: application.businessFactKey,
    requestHash: application.requestHash,
    decision:
      application.decision as WorkOrderFactApplicationRecord["decision"],
    decisionReason: application.decisionReason,
    previousState: application.previousState as WorkOrderState,
    resultingState: application.resultingState as WorkOrderState,
  };
}
