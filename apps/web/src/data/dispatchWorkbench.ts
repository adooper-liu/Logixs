import type { ContainerSummary } from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";

export interface DispatchQueueItem {
  task: NodeTaskDetail;
  container: ContainerSummary | null;
  urgency: "overdue" | "due_soon" | "blocked" | "normal";
  dueAt: string | null;
  actionLabel: string;
}

export function buildDispatchQueue(input: {
  tasks: readonly NodeTaskDetail[];
  containers: readonly ContainerSummary[];
  now?: Date;
}): DispatchQueueItem[] {
  const now = input.now ?? new Date();
  const soon = now.getTime() + 72 * 60 * 60 * 1000;
  const containers = new Map(input.containers.map((item) => [item.id, item]));
  return input.tasks
    .filter((task) => task.nodeCode === "shipment_dispatch")
    .map((task) => {
      const dueAt = task.nextAction?.dueAt ?? null;
      const due = dueAt ? new Date(dueAt).getTime() : null;
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
        dueAt,
        actionLabel:
          task.nextAction?.actionCode === "work_execution.claim_work_order"
            ? "领取出运任务"
            : task.nextAction?.actionCode ===
                "work_execution.complete_work_order"
              ? "完成出运工单"
              : "查看出运缺口",
      } satisfies DispatchQueueItem;
    })
    .sort((left, right) => rank(left.urgency) - rank(right.urgency));
}

function rank(value: DispatchQueueItem["urgency"]): number {
  return { overdue: 0, due_soon: 1, blocked: 2, normal: 3 }[value];
}
