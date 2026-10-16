import type { ContainerSummary } from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";

export type StuffingQueueFilter =
  "mine" | "executable" | "blocked" | "due_soon" | "history" | "all";

interface StuffingQueueItemBase {
  title: string;
  responsibility: string;
  urgencyLabel: string;
  urgencyRank: number;
  actionLabel: string | null;
}

export interface StuffingTaskQueueItem extends StuffingQueueItemBase {
  kind: "task";
  task: NodeTaskDetail;
  container: ContainerSummary | null;
  dueAt: string | null;
  isMine: boolean;
  isExecutable: boolean;
  isBlocked: boolean;
  isDueSoon: boolean;
  blockerReason: string | null;
}

export interface StuffingHistoricalQueueItem extends StuffingQueueItemBase {
  kind: "historical_snapshot";
  container: ContainerSummary;
}

export type StuffingQueueItem =
  StuffingTaskQueueItem | StuffingHistoricalQueueItem;

export function buildStuffingQueue(input: {
  tasks: readonly NodeTaskDetail[];
  containers: readonly ContainerSummary[];
  historicalContainers: readonly ContainerSummary[];
  /** 会话 actor；缺失时不把任何任务判为“我的”。 */
  actorId: string | null;
  now?: Date;
}): StuffingQueueItem[] {
  const now = input.now ?? new Date();
  const dueSoonBoundary = now.getTime() + 72 * 60 * 60 * 1000;
  const containers = new Map(input.containers.map((item) => [item.id, item]));

  const taskItems: StuffingTaskQueueItem[] = input.tasks
    .filter((task) => task.nodeCode === "container_stuffing")
    .map((task) => {
      const dueAt = task.nextAction?.dueAt ?? earliestDueAt(task);
      const dueTime = dueAt ? new Date(dueAt).getTime() : null;
      const overdue = dueTime !== null && dueTime < now.getTime();
      const isDueSoon = dueTime !== null && dueTime <= dueSoonBoundary;
      const isBlocked =
        task.state === "blocked" ||
        task.readinessState === "waiting_conditions";
      const assigneeId = task.nextAction?.assigneeId ?? assignedWorkOrder(task);
      const isMine = Boolean(
        input.actorId && assigneeId && assigneeId === input.actorId,
      );
      return {
        kind: "task" as const,
        task,
        container: task.containerId
          ? (containers.get(task.containerId) ?? null)
          : null,
        title: "完成装箱确认",
        responsibility: isMine
          ? "我负责"
          : assigneeId
            ? `已分配：${assigneeId}`
            : "装箱共享池",
        dueAt,
        urgencyLabel: overdue
          ? "已逾期"
          : isDueSoon
            ? "临期"
            : isBlocked
              ? "受阻"
              : "常规",
        urgencyRank: overdue ? 0 : isDueSoon ? 1 : isBlocked ? 2 : 3,
        isMine,
        isExecutable: Boolean(task.nextAction),
        isBlocked,
        isDueSoon,
        blockerReason: blockerReason(task),
        actionLabel: actionLabel(task.nextAction?.actionCode),
      };
    })
    .sort(
      (left, right) =>
        left.urgencyRank - right.urgencyRank ||
        compareNullableDates(left.dueAt, right.dueAt) ||
        left.task.id.localeCompare(right.task.id),
    );
  const taskContainerIds = new Set(
    taskItems.flatMap((item) => (item.container ? [item.container.id] : [])),
  );
  const historicalItems: StuffingHistoricalQueueItem[] =
    input.historicalContainers
      .filter((container) => !taskContainerIds.has(container.id))
      .map((container) => ({
        kind: "historical_snapshot" as const,
        container,
        title: "查看历史装箱事实",
        responsibility: "只读历史",
        urgencyLabel: "历史",
        urgencyRank: 4,
        actionLabel: "查看只读快照",
      }));
  return [...taskItems, ...historicalItems];
}

export function filterStuffingQueue(
  items: readonly StuffingQueueItem[],
  filter: StuffingQueueFilter,
): StuffingQueueItem[] {
  if (filter === "all") return [...items];
  if (filter === "history")
    return items.filter((item) => item.kind === "historical_snapshot");
  return items.filter((item) => {
    if (item.kind !== "task") return false;
    if (filter === "mine") return item.isMine;
    if (filter === "executable") return item.isExecutable;
    if (filter === "blocked") return item.isBlocked;
    return item.isDueSoon;
  });
}

function assignedWorkOrder(task: NodeTaskDetail): string | null {
  return (
    task.workOrders.find((workOrder) => workOrder.assigneeId)?.assigneeId ??
    null
  );
}

function earliestDueAt(task: NodeTaskDetail): string | null {
  return (
    task.workOrders
      .map((workOrder) => workOrder.dueAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null
  );
}

function blockerReason(task: NodeTaskDetail): string | null {
  if (task.readinessState === "waiting_conditions") return "前序条件尚未具备";
  if (task.state === "blocked") return "任务已阻塞，需要处理缺口";
  if (!task.nextAction && task.state !== "completed")
    return "等待系统给出下一动作";
  return null;
}

function actionLabel(actionCode: string | undefined): string | null {
  if (actionCode === "work_execution.claim_work_order") return "领取任务";
  if (actionCode === "work_execution.complete_work_order")
    return "完成装箱工单";
  return actionCode ? "处理当前任务" : null;
}

function compareNullableDates(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}
