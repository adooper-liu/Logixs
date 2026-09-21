import type { ContainerSummary } from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";

export interface UnloadingQueueItem {
  task: NodeTaskDetail;
  container: ContainerSummary | null;
  urgency: "overdue" | "due_soon" | "blocked" | "normal";
  actionLabel: string;
}

export function buildUnloadingQueue(input: {
  tasks: readonly NodeTaskDetail[];
  containers: readonly ContainerSummary[];
  now?: Date;
}): UnloadingQueueItem[] {
  const now = input.now ?? new Date();
  const soon = now.getTime() + 72 * 60 * 60 * 1000;
  const containers = new Map(input.containers.map((item) => [item.id, item]));
  return input.tasks
    .filter((task) => task.nodeCode === "container_unloading")
    .map((task) => {
      const dueAt = task.nextAction?.dueAt
        ? new Date(task.nextAction.dueAt).getTime()
        : null;
      const blocked =
        task.state === "blocked" ||
        task.readinessState === "waiting_conditions";
      const urgency: UnloadingQueueItem["urgency"] =
        dueAt !== null && dueAt < now.getTime()
          ? "overdue"
          : dueAt !== null && dueAt <= soon
            ? "due_soon"
            : blocked
              ? "blocked"
              : "normal";
      return {
        task,
        container: task.containerId
          ? (containers.get(task.containerId) ?? null)
          : null,
        urgency,
        actionLabel:
          task.nextAction?.actionCode === "work_execution.claim_work_order"
            ? "领取卸柜任务"
            : task.nextAction?.actionCode ===
                "work_execution.complete_work_order"
              ? "完成卸柜工单"
              : "查看卸柜缺口",
      };
    })
    .sort((left, right) => rank(left.urgency) - rank(right.urgency));
}

function rank(value: UnloadingQueueItem["urgency"]): number {
  return { overdue: 0, due_soon: 1, blocked: 2, normal: 3 }[value];
}
