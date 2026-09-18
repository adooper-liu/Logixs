import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AssistantAllowedAction,
  AssistantObjectContext,
} from "@logix/contracts";
import {
  LIST_CONTAINER_CURRENT_NODES,
  type ListContainerCurrentNodesPort,
} from "../../lifecycle-control";
import {
  GET_CONTAINER_SUMMARY,
  type GetContainerSummaryPort,
} from "../../shipment-registry";
import {
  LIST_OBJECT_TASK_ACTIVITY,
  type ListObjectTaskActivityPort,
} from "../../work-execution";

const TASK_READ = "task.read";
const TASK_EXECUTE = "task.execute";
const LIFECYCLE_READ = "lifecycle.read";

@Injectable()
export class BuildAssistantObjectContextService {
  constructor(
    @Inject(GET_CONTAINER_SUMMARY)
    private readonly containers: GetContainerSummaryPort,
    @Inject(LIST_CONTAINER_CURRENT_NODES)
    private readonly currentNodes: ListContainerCurrentNodesPort,
    @Inject(LIST_OBJECT_TASK_ACTIVITY)
    private readonly taskActivity: ListObjectTaskActivityPort,
  ) {}

  async execute(input: {
    tenantId: string;
    containerId: string;
    actorCapabilities: readonly string[];
  }): Promise<AssistantObjectContext> {
    if (!input.actorCapabilities.includes("container.read")) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }

    const summary = await this.containers.execute({
      tenantId: input.tenantId,
      id: input.containerId,
    });
    const canReadLifecycle = input.actorCapabilities.includes(LIFECYCLE_READ);
    const canReadTasks = input.actorCapabilities.includes(TASK_READ);
    const actorCanExecute = input.actorCapabilities.includes(TASK_EXECUTE);

    const [currentNodePage, taskPage] = await Promise.all([
      canReadLifecycle
        ? this.currentNodes.execute({
            tenantId: input.tenantId,
            containerIds: input.containerId,
          })
        : null,
      canReadTasks
        ? this.taskActivity.execute({
            tenantId: input.tenantId,
            containerId: input.containerId,
            atOrBefore: new Date(),
            take: 1,
          })
        : null,
    ]);

    const currentNode = currentNodePage?.items[0] ?? null;
    const allowedActions = (taskPage?.nextActions ?? []).map((action) =>
      toAllowedAction(action, actorCanExecute),
    );
    const actionSummary = canReadTasks
      ? allowedActions.length > 0
        ? `当前有 ${allowedActions.length} 个下一动作；请到任务工作台执行。`
        : "当前没有可执行的下一动作。"
      : "当前身份无任务查看权限，未展示下一动作。";

    return {
      summary: {
        containerId: summary.id,
        orderNumber: summary.orderNumber,
        containerNumber: summary.containerNumber,
        currentStatus: summary.currentStatus,
        currentNodeCode: currentNode?.currentNodeCode ?? null,
        flowState: currentNode?.flowState ?? null,
        updatedAt: summary.updatedAt,
      },
      allowedActions,
      actionSummary,
      readOnlyPolicy: {
        assistantCanExecute: false,
        actorCanExecuteActions: actorCanExecute,
        explanation: actorCanExecute
          ? "助手只解释现状；你可到任务工作台执行服务端列出的动作。"
          : "助手只解释现状；当前身份也没有执行任务的权限。",
      },
    };
  }

  async assertNotificationReference(input: {
    tenantId: string;
    containerId: string;
    taskId: string | null;
    workOrderId: string | null;
  }): Promise<void> {
    const taskId = input.taskId;
    if (!taskId) {
      if (input.workOrderId) {
        throw new NotFoundException("RESOURCE_NOT_FOUND");
      }
      return;
    }
    const target = await this.taskActivity.resolveTarget({
      ...input,
      taskId,
    });
    if (!target) throw new NotFoundException("RESOURCE_NOT_FOUND");
  }
}

function toAllowedAction(
  action: Awaited<
    ReturnType<ListObjectTaskActivityPort["execute"]>
  >["nextActions"][number],
  actorCanExecute: boolean,
): AssistantAllowedAction {
  return {
    actionCode: action.actionCode,
    explanation:
      action.actionCode === "work_execution.claim_work_order"
        ? "该工单已具备领取条件，可在任务工作台领取。"
        : "该工单已具备提交条件，可在任务工作台提交完成。",
    containerId: action.containerId,
    taskId: action.taskId,
    workOrderId: action.workOrderId,
    nodeCode: action.nodeCode,
    assigneeId: action.assigneeId,
    dueAt: action.dueAt?.toISOString() ?? null,
    actorCanExecute,
    targetPath: taskPath(action.containerId, action.taskId),
  };
}

function taskPath(containerId: string, taskId: string): string {
  const query = new URLSearchParams({ containerId, task: taskId });
  return `/tasks?${query.toString()}`;
}
