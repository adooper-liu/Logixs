import { computed, readonly, ref, shallowRef, watch, type Ref } from "vue";
import {
  getContainer,
  getContainerCargo,
  listContainers,
  type ContainerCargoScope,
  type ContainerSummary,
} from "../api/containers";
import {
  getCargoReadyCompliance,
  type CargoReadyComplianceAssessment,
} from "../api/cargoReadyCompliance";
import { listLifecycleNodes } from "../api/lifecycleNodes";
import {
  DEV_OPERATOR_ID,
  listNodeTasks,
  type NodeTaskDetail,
} from "../api/nodeTasks";
import { listExternalWorkItems, type ExternalWorkItem } from "../api/workItems";
import {
  buildCargoReadyQueue,
  buildCargoReadySkuReadiness,
} from "../data/cargoReadyWorkbench";
import { toLiveNode, type LiveNodeView } from "../data/liveNodeProjection";

export interface WorkbenchProjectionWarning {
  code: "cargo" | "nodes" | "tasks" | "remediation" | "compliance";
  message: string;
}

const WARNING_MESSAGES: Record<WorkbenchProjectionWarning["code"], string> = {
  cargo: "装载明细暂时没能加载",
  nodes: "节点进度暂时没能加载",
  tasks: "生命周期任务暂时没能加载",
  remediation: "合规整改项暂时没能加载",
  compliance: "合规评审暂时没能加载",
};

export function useCargoReadyWorkbench(
  containerId: Ref<string>,
  taskId: Ref<string>,
) {
  const containers = ref<ContainerSummary[]>([]);
  const taskPool = ref<NodeTaskDetail[]>([]);
  const remediationPool = ref<ExternalWorkItem[]>([]);
  const selectedContainer = ref<ContainerSummary | null>(null);
  const cargo = ref<ContainerCargoScope | null>(null);
  const nodes = ref<LiveNodeView[]>([]);
  const nodeTasks = ref<NodeTaskDetail[]>([]);
  const remediationItems = ref<ExternalWorkItem[]>([]);
  const assessment = ref<CargoReadyComplianceAssessment | null>(null);
  const warnings = ref<WorkbenchProjectionWarning[]>([]);
  const containerListLoading = shallowRef(false);
  const queueLoading = shallowRef(false);
  const selectionLoading = shallowRef(false);
  const containerListError = shallowRef("");
  const queueError = shallowRef("");
  const selectionError = shallowRef("");
  let selectionRevision = 0;

  const cargoReadyNode = computed(
    () => nodes.value.find((node) => node.nodeCode === "cargo_ready") ?? null,
  );
  const cargoReadyTasks = computed(() =>
    nodeTasks.value.filter((task) => task.nodeCode === "cargo_ready"),
  );
  const queueItems = computed(() =>
    buildCargoReadyQueue({
      tasks: taskPool.value,
      containers: containers.value,
      actorId: DEV_OPERATOR_ID,
    }),
  );
  const selectedTask = computed(
    () =>
      cargoReadyTasks.value.find((task) => task.id === taskId.value) ??
      cargoReadyTasks.value[0] ??
      null,
  );
  const skuReadiness = computed(() =>
    buildCargoReadySkuReadiness({
      cargo: cargo.value,
      assessment: assessment.value,
      remediationItems: remediationItems.value,
    }),
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
    const [containerResult, taskResult, remediationResult] =
      await Promise.allSettled([
        listContainers({ pageSize: 100 }),
        listNodeTasks({ pageSize: 100 }),
        listExternalWorkItems({ pageSize: 100 }),
      ] as const);
    if (containerResult.status === "fulfilled") {
      containers.value = containerResult.value.items;
    } else {
      containers.value = [];
      containerListError.value = "货柜列表暂时没能加载";
    }
    taskPool.value =
      taskResult.status === "fulfilled" ? taskResult.value.items : [];
    remediationPool.value =
      remediationResult.status === "fulfilled"
        ? remediationResult.value.items
        : [];
    if (
      taskResult.status === "rejected" ||
      remediationResult.status === "rejected"
    ) {
      queueError.value = "备货任务池暂时没有完整加载，请稍后重试";
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
      listExternalWorkItems({ containerId: id, pageSize: 100 }),
      getCargoReadyCompliance(id),
    ] as const);
    if (revision !== selectionRevision) return;

    const [
      containerResult,
      cargoResult,
      nodeResult,
      taskResult,
      workItemResult,
      complianceResult,
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
    remediationItems.value =
      readProjection(workItemResult, "remediation")?.items ?? [];
    assessment.value = readProjection(complianceResult, "compliance");
    syncCurrentContainerProjections(id);
    selectionLoading.value = false;
  }

  function syncCurrentContainerProjections(id: string): void {
    taskPool.value = [
      ...taskPool.value.filter((task) => task.containerId !== id),
      ...nodeTasks.value,
    ];
    remediationPool.value = [
      ...remediationPool.value.filter((item) => item.containerId !== id),
      ...remediationItems.value,
    ];
  }

  function readProjection<T>(
    result: PromiseSettledResult<T>,
    code: WorkbenchProjectionWarning["code"],
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
    remediationItems.value = [];
    assessment.value = null;
    warnings.value = [];
    selectionError.value = "";
    selectionLoading.value = false;
  }

  return {
    containers: readonly(containers),
    selectedContainer: readonly(selectedContainer),
    cargo: readonly(cargo),
    nodes: readonly(nodes),
    cargoReadyNode,
    cargoReadyTasks,
    queueItems,
    selectedTask,
    skuReadiness,
    remediationItems: readonly(remediationItems),
    remediationPool: readonly(remediationPool),
    assessment: readonly(assessment),
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
