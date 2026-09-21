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
import {
  DEV_OPERATOR_ID,
  listNodeTasks,
  type NodeTaskDetail,
} from "../api/nodeTasks";
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

export function useStuffingWorkbench(
  containerId: Ref<string>,
  taskId: Ref<string>,
) {
  const containers = ref<ContainerSummary[]>([]);
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

  const stuffingNode = computed(
    () =>
      nodes.value.find((node) => node.nodeCode === "container_stuffing") ??
      null,
  );
  const stuffingTasks = computed(() =>
    nodeTasks.value.filter((task) => task.nodeCode === "container_stuffing"),
  );
  const queueItems = computed(() =>
    buildStuffingQueue({
      tasks: taskPool.value,
      containers: containers.value,
      actorId: DEV_OPERATOR_ID,
    }),
  );
  const selectedTask = computed(
    () =>
      stuffingTasks.value.find((task) => task.id === taskId.value) ??
      stuffingTasks.value[0] ??
      null,
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
    const [containerResult, taskResult] = await Promise.allSettled([
      listContainers({ pageSize: 100 }),
      listNodeTasks({ pageSize: 100 }),
    ] as const);
    containers.value =
      containerResult.status === "fulfilled" ? containerResult.value.items : [];
    taskPool.value =
      taskResult.status === "fulfilled" ? taskResult.value.items : [];
    if (containerResult.status === "rejected") {
      containerListError.value = "货柜列表暂时没能加载";
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
      listNodeTasks({ containerId: id, pageSize: 100 }),
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
    nodeTasks.value = readProjection(taskResult, "tasks")?.items ?? [];
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
