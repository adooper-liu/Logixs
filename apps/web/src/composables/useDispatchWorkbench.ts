import { computed, readonly, ref, shallowRef, watch, type Ref } from "vue";
import {
  getContainer,
  listContainers,
  type ContainerSummary,
} from "../api/containers";
import {
  getContainerDispatchSnapshot,
  type ContainerDispatchSnapshot,
} from "../api/containerDispatch";
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
import { buildDispatchQueue } from "../data/dispatchWorkbench";
import { toLiveNode, type LiveNodeView } from "../data/liveNodeProjection";

export function useDispatchWorkbench(
  containerId: Ref<string>,
  taskId: Ref<string>,
) {
  const containers = ref<ContainerSummary[]>([]);
  const taskPool = ref<NodeTaskDetail[]>([]);
  const selectedContainer = ref<ContainerSummary | null>(null);
  const nodes = ref<LiveNodeView[]>([]);
  const tasks = ref<NodeTaskDetail[]>([]);
  const stuffing = ref<ContainerStuffingSnapshot | null>(null);
  const dispatch = ref<ContainerDispatchSnapshot | null>(null);
  const dates = ref<LifecycleDateFactProjection | null>(null);
  const loading = shallowRef(false);
  const queueLoading = shallowRef(false);
  const error = shallowRef("");
  const warnings = ref<{ code: string; message: string }[]>([]);
  let revision = 0;

  const queueItems = computed(() =>
    buildDispatchQueue({ tasks: taskPool.value, containers: containers.value }),
  );
  const selectedTask = computed(
    () =>
      tasks.value.find((task) => task.id === taskId.value) ??
      tasks.value.find((task) => task.nodeCode === "shipment_dispatch") ??
      null,
  );
  const dispatchNode = computed(
    () =>
      nodes.value.find((node) => node.nodeCode === "shipment_dispatch") ?? null,
  );
  const gateInFact = computed(() => currentActual("gate_in"));
  const loadedFact = computed(() => currentActual("loaded"));

  watch(containerId, (id) => void loadSelection(id, ++revision), {
    immediate: true,
  });

  async function loadQueue(): Promise<void> {
    queueLoading.value = true;
    const [containerResult, taskResult] = await Promise.allSettled([
      listContainers({ pageSize: 100 }),
      listNodeTasks({ pageSize: 100 }),
    ]);
    containers.value =
      containerResult.status === "fulfilled" ? containerResult.value.items : [];
    taskPool.value =
      taskResult.status === "fulfilled" ? taskResult.value.items : [];
    if (taskResult.status === "rejected")
      error.value = "出运任务池暂时没能加载";
    queueLoading.value = false;
  }

  async function reload(): Promise<void> {
    await Promise.all([
      loadSelection(containerId.value, ++revision),
      loadQueue(),
    ]);
  }

  async function loadSelection(
    id: string,
    currentRevision: number,
  ): Promise<void> {
    reset();
    if (!id) return;
    loading.value = true;
    const results = await Promise.allSettled([
      getContainer(id),
      listLifecycleNodes(id),
      listNodeTasks({ containerId: id, pageSize: 100 }),
      getContainerStuffingSnapshot(id),
      getContainerDispatchSnapshot(id),
      listLifecycleDateFacts(id),
    ] as const);
    if (currentRevision !== revision) return;
    if (results[0].status === "rejected") {
      error.value = "货柜没能加载";
      loading.value = false;
      return;
    }
    selectedContainer.value = results[0].value;
    nodes.value =
      read(results[1], "nodes", "节点进度暂时没能加载")?.nodes.map(
        toLiveNode,
      ) ?? [];
    tasks.value =
      read(results[2], "tasks", "出运任务暂时没能加载")?.items ?? [];
    stuffing.value = read(results[3], "stuffing", "装箱基线暂时没能加载");
    dispatch.value = read(results[4], "dispatch", "出运交接暂时没能加载");
    dates.value = read(results[5], "dates", "进港与装船日期暂时没能加载");
    loading.value = false;
  }

  function read<T>(
    result: PromiseSettledResult<T>,
    code: string,
    message: string,
  ): T | null {
    if (result.status === "fulfilled") return result.value;
    warnings.value.push({ code, message });
    return null;
  }

  function currentActual(eventCode: string) {
    return (
      dates.value?.items.find(
        (fact) =>
          fact.nodeCode === "shipment_dispatch" &&
          fact.eventCode === eventCode &&
          fact.timeKind === "actual" &&
          fact.validity === "effective",
      ) ?? null
    );
  }

  function reset(): void {
    selectedContainer.value = null;
    nodes.value = [];
    tasks.value = [];
    stuffing.value = null;
    dispatch.value = null;
    dates.value = null;
    warnings.value = [];
    error.value = "";
  }

  return {
    containers: readonly(containers),
    selectedContainer: readonly(selectedContainer),
    nodes: readonly(nodes),
    queueItems,
    selectedTask,
    dispatchNode,
    stuffing: readonly(stuffing),
    dispatch: readonly(dispatch),
    dates: readonly(dates),
    gateInFact,
    loadedFact,
    loading: readonly(loading),
    queueLoading: readonly(queueLoading),
    error: readonly(error),
    warnings: readonly(warnings),
    loadQueue,
    reload,
  };
}
