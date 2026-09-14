import { Inject, Injectable } from "@nestjs/common";
import type {
  AssignmentState,
  LifecycleNodeCode,
  NodeTaskState,
  WorkOrderState,
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
    const owned = await this.prisma.containerRecord.findMany({
      where: { tenantId: input.tenantId },
      select: { id: true },
    });
    const containerIds = owned.map((row) => row.id);
    if (containerIds.length === 0) return [];

    const tasks = await this.prisma.nodeTask.findMany({
      where: {
        containerId: { in: containerIds },
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

  async createTaskWithRequiredWorkOrder(
    input: CreateTaskInput,
  ): Promise<NodeTaskWithWorkOrders> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.nodeTask.create({
        data: {
          flowInstanceId: input.flowInstanceId,
          nodeInstanceId: input.nodeInstanceId,
          nodeCode: input.nodeCode,
          containerId: input.containerId,
          taskDefinitionKey: input.taskDefinitionKey,
          state: "pending",
        },
      });
      const workOrder = await tx.workOrder.create({
        data: {
          nodeTaskId: task.id,
          workOrderDefinitionKey: input.workOrderDefinitionKey,
          state: "ready",
          assignmentState: "unassigned",
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
        },
      });
      if (updated.count === 0) return false;
      await tx.nodeTask.update({
        where: { id: input.taskId },
        data: { state: input.taskState },
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
        },
      });
      await tx.nodeTask.update({
        where: { id: input.taskId },
        data: { state: input.taskState },
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
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: string;
  containerId: string | null;
  taskDefinitionKey: string;
  state: string;
  createdAt: Date;
}): NodeTaskRecord {
  return {
    id: task.id,
    flowInstanceId: task.flowInstanceId,
    nodeInstanceId: task.nodeInstanceId,
    nodeCode: task.nodeCode as LifecycleNodeCode,
    containerId: task.containerId,
    taskDefinitionKey: task.taskDefinitionKey,
    state: task.state as NodeTaskState,
    createdAt: task.createdAt,
  };
}

function mapWorkOrder(workOrder: {
  id: string;
  nodeTaskId: string;
  workOrderDefinitionKey: string;
  state: string;
  assignmentState: string;
  assigneeId?: string | null;
  completedAt: Date | null;
}): WorkOrderRecord {
  return {
    id: workOrder.id,
    nodeTaskId: workOrder.nodeTaskId,
    workOrderDefinitionKey: workOrder.workOrderDefinitionKey,
    state: workOrder.state as WorkOrderState,
    assignmentState: workOrder.assignmentState as AssignmentState,
    assigneeId: workOrder.assigneeId ?? null,
    completedAt: workOrder.completedAt,
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
    evaluatedAt: outcome.evaluatedAt,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}
