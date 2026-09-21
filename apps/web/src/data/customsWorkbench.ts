import type { ContainerSummary } from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";

export interface CustomsQueueItem {
  task: NodeTaskDetail;
  container: ContainerSummary | null;
  urgency: "overdue" | "due_soon" | "blocked" | "normal";
  actionLabel: string;
}

export function buildCustomsQueue(input: {
  tasks: readonly NodeTaskDetail[];
  containers: readonly ContainerSummary[];
  now?: Date;
}): CustomsQueueItem[] {
  const now = input.now ?? new Date();
  const soon = now.getTime() + 72 * 60 * 60 * 1000;
  const containers = new Map(input.containers.map((item) => [item.id, item]));
  return input.tasks
    .filter((task) => task.nodeCode === "customs_clearance")
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
            ? "领取清关任务"
            : task.nextAction?.actionCode ===
                "work_execution.complete_work_order"
              ? "完成清关工单"
              : "查看清关缺口",
      } satisfies CustomsQueueItem;
    })
    .sort((left, right) => rank(left.urgency) - rank(right.urgency));
}

function rank(value: CustomsQueueItem["urgency"]): number {
  return { overdue: 0, due_soon: 1, blocked: 2, normal: 3 }[value];
}
