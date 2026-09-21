import { computed, readonly, ref, shallowRef, watch, type Ref } from "vue";
import {
  getContainer,
  listContainers,
  type ContainerSummary,
} from "../api/containers";
import {
  listLifecycleDateFacts,
  type LifecycleDateFact,
  type LifecycleDateFactProjection,
} from "../api/lifecycleDateFacts";
import { listLifecycleNodes } from "../api/lifecycleNodes";
import { listNodeTasks, type NodeTaskDetail } from "../api/nodeTasks";
import { buildPickupQueue } from "../data/pickupWorkbench";
import { toLiveNode, type LiveNodeView } from "../data/liveNodeProjection";

export function usePickupWorkbench(
  containerId: Ref<string>,
  taskId: Ref<string>,
) {
  const containers = ref<ContainerSummary[]>([]);
  const taskPool = ref<NodeTaskDetail[]>([]);
  const selectedContainer = ref<ContainerSummary | null>(null);
  const nodes = ref<LiveNodeView[]>([]);
  const tasks = ref<NodeTaskDetail[]>([]);
  const dates = ref<LifecycleDateFactProjection | null>(null);
  const loading = shallowRef(false);
  const queueLoading = shallowRef(false);
  const error = shallowRef("");
  const warnings = ref<{ code: string; message: string }[]>([]);
  let revision = 0;

  const queueItems = computed(() =>
    buildPickupQueue({ tasks: taskPool.value, containers: containers.value }),
  );
  const selectedTask = computed(
    () =>
      tasks.value.find((task) => task.id === taskId.value) ??
      tasks.value.find((task) => task.nodeCode === "container_pickup") ??
      null,
  );
  const pickupNode = computed(
    () =>
      nodes.value.find((node) => node.nodeCode === "container_pickup") ?? null,
  );
  const arrivalFact = computed(() =>
    currentActual(dates.value, "destination_arrival", "arrived"),
  );
  const customsFact = computed(() =>
    currentActual(
      dates.value,
      "customs_clearance",
      "container_customs_completed",
    ),
  );
  const availableFact = computed(() =>
    currentActual(dates.value, "container_pickup", "available"),
  );
  const gateOutFact = computed(() =>
    currentActual(dates.value, "container_pickup", "gate_out"),
  );

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
      error.value = "提柜任务池暂时没能加载";
    queueLoading.value = false;
  }

  async function reload(): Promise<void> {
    await Promise.all([
      loadSelection(containerId.value, ++revision),
      loadQueue(),
    ]);
  }

  async function loadSelection(id: string, currentRevision: number) {
    reset();
    if (!id) return;
    loading.value = true;
    const results = await Promise.allSettled([
      getContainer(id),
      listLifecycleNodes(id),
      listNodeTasks({ containerId: id, pageSize: 100 }),
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
      read(results[2], "tasks", "提柜任务暂时没能加载")?.items ?? [];
    dates.value = read(results[3], "dates", "提柜日期暂时没能加载");
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

  function reset() {
    selectedContainer.value = null;
    nodes.value = [];
    tasks.value = [];
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
    pickupNode,
    dates: readonly(dates),
    arrivalFact,
    customsFact,
    availableFact,
    gateOutFact,
    loading: readonly(loading),
    queueLoading: readonly(queueLoading),
    error: readonly(error),
    warnings: readonly(warnings),
    loadQueue,
    reload,
  };
}

function currentActual(
  projection: LifecycleDateFactProjection | null,
  nodeCode: string,
  eventCode: string,
): LifecycleDateFact | null {
  return (
    projection?.items.find(
      (fact) =>
        fact.nodeCode === nodeCode &&
        fact.eventCode === eventCode &&
        fact.timeKind === "actual" &&
        fact.validity === "effective",
    ) ?? null
  );
}
