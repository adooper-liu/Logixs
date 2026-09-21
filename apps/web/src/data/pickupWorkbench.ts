import type { ContainerSummary } from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";

export interface PickupQueueItem {
  task: NodeTaskDetail;
  container: ContainerSummary | null;
  urgency: "overdue" | "due_soon" | "blocked" | "normal";
  actionLabel: string;
}

export function buildPickupQueue(input: {
  tasks: readonly NodeTaskDetail[];
  containers: readonly ContainerSummary[];
  now?: Date;
}): PickupQueueItem[] {
  const now = input.now ?? new Date();
  const soon = now.getTime() + 72 * 60 * 60 * 1000;
  const containers = new Map(input.containers.map((item) => [item.id, item]));
  return input.tasks
    .filter((task) => task.nodeCode === "container_pickup")
    .map((task) => {
      const due = task.nextAction?.dueAt
        ? new Date(task.nextAction.dueAt).getTime()
        : null;
      const blocked =
        task.state === "blocked" ||
        task.readinessState === "waiting_conditions";
      return {
        task,
        container: task.containerId
          ? (containers.get(task.containerId) ?? null)
          : null,
        urgency:
          due !== null && due < now.getTime()
            ? "overdue"
            : due !== null && due <= soon
              ? "due_soon"
              : blocked
                ? "blocked"
                : "normal",
        actionLabel:
          task.nextAction?.actionCode === "work_execution.claim_work_order"
            ? "领取提柜任务"
            : task.nextAction?.actionCode ===
                "work_execution.complete_work_order"
              ? "完成提柜工单"
              : "查看提柜缺口",
      } satisfies PickupQueueItem;
    })
    .sort((left, right) => rank(left.urgency) - rank(right.urgency));
}

function rank(value: PickupQueueItem["urgency"]): number {
  return { overdue: 0, due_soon: 1, blocked: 2, normal: 3 }[value];
}
