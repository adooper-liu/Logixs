import { computed, readonly, ref, shallowRef, watch, type Ref } from "vue";
import {
  getContainer,
  getContainerCargo,
  listContainers,
  type ContainerCargoScope,
  type ContainerSummary,
} from "../api/containers";
import {
  getContainerStuffingSnapshot,
  type ContainerStuffingSnapshot,
} from "../api/containerStuffing";
import {
  listLifecycleDateFacts,
  type LifecycleDateFactProjection,
} from "../api/lifecycleDateFacts";
import { listLifecycleNodes } from "../api/lifecycleNodes";
import { listNodeTasks, type NodeTaskDetail } from "../api/nodeTasks";
import { useAuthSession } from "../auth/useAuthSession";
import { buildStuffingQueue } from "../data/stuffingWorkbench";
import { toLiveNode, type LiveNodeView } from "../data/liveNodeProjection";

export interface StuffingProjectionWarning {
  code: "cargo" | "nodes" | "tasks" | "snapshot" | "date_facts";
  message: string;
}

const WARNING_MESSAGES: Record<StuffingProjectionWarning["code"], string> = {
  cargo: "装载明细暂时没能加载",
  nodes: "节点进度暂时没能加载",
  tasks: "装箱任务暂时没能加载",
  snapshot: "装箱记录暂时没能加载",
  date_facts: "装箱日期暂时没能加载",
};

type CursorPage<T> = {
  items: T[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
};

export function selectStuffingTask(
  tasks: readonly NodeTaskDetail[],
  requestedTaskId: string,
  containerId: string,
): NodeTaskDetail | null {
  const candidates = tasks.filter(
    (task) =>
      task.nodeCode === "container_stuffing" &&
      task.containerId === containerId,
  );
  if (requestedTaskId) {
    return candidates.find((task) => task.id === requestedTaskId) ?? null;
  }
  return candidates[0] ?? null;
}

export async function collectCursorPages<T>(
  loadPage: (cursor?: string) => Promise<CursorPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await loadPage(cursor);
    items.push(...page.items);
    if (!page.pageInfo.hasNextPage) return items;
    const nextCursor = page.pageInfo.nextCursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("PAGINATION_CURSOR_INVALID");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

export function useStuffingWorkbench(
  containerId: Ref<string>,
  taskId: Ref<string>,
) {
  const containers = ref<ContainerSummary[]>([]);
  const historicalContainers = ref<ContainerSummary[]>([]);
  const taskPool = ref<NodeTaskDetail[]>([]);
  const selectedContainer = ref<ContainerSummary | null>(null);
  const cargo = ref<ContainerCargoScope | null>(null);
  const nodes = ref<LiveNodeView[]>([]);
  const nodeTasks = ref<NodeTaskDetail[]>([]);
  const snapshot = ref<ContainerStuffingSnapshot | null>(null);
  const dateFacts = ref<LifecycleDateFactProjection | null>(null);
  const warnings = ref<StuffingProjectionWarning[]>([]);
  const containerListLoading = shallowRef(false);
  const queueLoading = shallowRef(false);
  const selectionLoading = shallowRef(false);
  const containerListError = shallowRef("");
  const queueError = shallowRef("");
  const selectionError = shallowRef("");
  let selectionRevision = 0;
  const { actorId } = useAuthSession();

  const stuffingNode = computed(
    () =>
      nodes.value.find((node) => node.nodeCode === "container_stuffing") ??
      null,
  );
  const queueItems = computed(() =>
    buildStuffingQueue({
      tasks: taskPool.value,
      containers: containers.value,
      historicalContainers: historicalContainers.value,
      actorId: actorId.value,
    }).map((item) =>
      item.kind === "task" && item.responsibility.startsWith("已分配：")
        ? { ...item, responsibility: "已分配人员" }
        : item,
    ),
  );
  const selectedTask = computed(() =>
    selectStuffingTask(
      nodeTasks.value,
      taskId.value,
      selectedContainer.value?.id ?? containerId.value,
    ),
  );
  const stuffingActualFact = computed(
    () =>
      dateFacts.value?.items.find(
        (fact) =>
          fact.nodeCode === "container_stuffing" &&
          fact.eventCode === "stuffed" &&
          fact.timeKind === "actual" &&
          fact.validity === "effective",
      ) ?? null,
  );

  watch(
    containerId,
    (id, _previous, onCleanup) => {
      const revision = ++selectionRevision;
      onCleanup(() => {
        if (selectionRevision === revision) selectionRevision += 1;
      });
      void loadSelection(id, revision);
    },
    { immediate: true },
  );

  async function loadContainerList(): Promise<void> {
    containerListLoading.value = true;
    queueLoading.value = true;
    containerListError.value = "";
    queueError.value = "";
    const [containerResult, historyResult, taskResult] =
      await Promise.allSettled([
        collectCursorPages((cursor) =>
          listContainers({ pageSize: 100, cursor }),
        ),
        collectCursorPages((cursor) =>
          listContainers({
            pageSize: 100,
            cursor,
            scope: "active_stuffing_snapshot",
          }),
        ),
        collectCursorPages((cursor) =>
          listNodeTasks({ pageSize: 100, cursor }),
        ),
      ] as const);
    containers.value =
      containerResult.status === "fulfilled" ? containerResult.value : [];
    historicalContainers.value =
      historyResult.status === "fulfilled" ? historyResult.value : [];
    taskPool.value = taskResult.status === "fulfilled" ? taskResult.value : [];
    if (containerResult.status === "rejected") {
      containerListError.value = "货柜列表暂时没能加载";
    } else if (historyResult.status === "rejected") {
      containerListError.value = "历史装箱事实暂时没能加载";
    }
    if (taskResult.status === "rejected") {
      queueError.value = "装箱任务池暂时没能加载，请稍后重试";
    }
    containerListLoading.value = false;
    queueLoading.value = false;
  }

  async function reloadSelection(): Promise<void> {
    const revision = ++selectionRevision;
    await loadSelection(containerId.value, revision);
  }

  async function loadSelection(id: string, revision: number): Promise<void> {
    resetSelection();
    if (!id) return;
    selectionLoading.value = true;
    const results = await Promise.allSettled([
      getContainer(id),
      getContainerCargo(id),
      listLifecycleNodes(id),
      collectCursorPages((cursor) =>
        listNodeTasks({ containerId: id, pageSize: 100, cursor }),
      ),
      getContainerStuffingSnapshot(id),
      listLifecycleDateFacts(id),
    ] as const);
    if (revision !== selectionRevision) return;
    const [
      containerResult,
      cargoResult,
      nodeResult,
      taskResult,
      snapshotResult,
      dateFactResult,
    ] = results;
    if (containerResult.status === "rejected") {
      selectionError.value =
        containerResult.reason instanceof Error &&
        containerResult.reason.message === "RESOURCE_NOT_FOUND"
          ? "找不到这只货柜"
          : "货柜没能加载";
      selectionLoading.value = false;
      return;
    }

    selectedContainer.value = containerResult.value;
    cargo.value = readProjection(cargoResult, "cargo");
    const nodePage = readProjection(nodeResult, "nodes");
    nodes.value = nodePage?.nodes.map(toLiveNode) ?? [];
    nodeTasks.value = readProjection(taskResult, "tasks") ?? [];
    snapshot.value = readProjection(snapshotResult, "snapshot");
    dateFacts.value = readProjection(dateFactResult, "date_facts");
    taskPool.value = [
      ...taskPool.value.filter((task) => task.containerId !== id),
      ...nodeTasks.value,
    ];
    selectionLoading.value = false;
  }

  function readProjection<T>(
    result: PromiseSettledResult<T>,
    code: StuffingProjectionWarning["code"],
  ): T | null {
    if (result.status === "fulfilled") return result.value;
    warnings.value.push({ code, message: WARNING_MESSAGES[code] });
    return null;
  }

  function resetSelection(): void {
    selectedContainer.value = null;
    cargo.value = null;
    nodes.value = [];
    nodeTasks.value = [];
    snapshot.value = null;
    dateFacts.value = null;
    warnings.value = [];
    selectionError.value = "";
    selectionLoading.value = false;
  }

  return {
    containers: readonly(containers),
    selectedContainer: readonly(selectedContainer),
    cargo: readonly(cargo),
    nodes: readonly(nodes),
    stuffingNode,
    queueItems,
    selectedTask,
    snapshot: readonly(snapshot),
    dateFacts: readonly(dateFacts),
    stuffingActualFact,
    warnings: readonly(warnings),
    containerListLoading: readonly(containerListLoading),
    queueLoading: readonly(queueLoading),
    selectionLoading: readonly(selectionLoading),
    containerListError: readonly(containerListError),
    queueError: readonly(queueError),
    selectionError: readonly(selectionError),
    loadContainerList,
    reloadSelection,
  };
}
