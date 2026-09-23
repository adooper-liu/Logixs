import { computed, readonly, ref, shallowRef, watch, type Ref } from "vue";
import {
  getCargoReadyCompliance,
  type CargoReadyComplianceAssessment,
} from "../api/cargoReadyCompliance";
import { listLifecycleNodes } from "../api/lifecycleNodes";
import { listNodeTasks, type NodeTaskDetail } from "../api/nodeTasks";
import {
  listReplenishmentOrders,
  type ReplenishmentOrderWorkbenchItem,
} from "../api/replenishmentOrders";
import { listExternalWorkItems, type ExternalWorkItem } from "../api/workItems";
import {
  buildCargoReadyComplianceEvaluations,
  buildCargoReadyOrderQueue,
  buildCargoReadySkuViews,
} from "../data/cargoReadyWorkbench";

export interface WorkbenchProjectionWarning {
  code: "nodes" | "tasks" | "remediation" | "compliance";
  message: string;
}

const WARNING_MESSAGES: Record<WorkbenchProjectionWarning["code"], string> = {
  nodes: "关联货柜的节点进度暂时没能加载",
  tasks: "备货动作暂时没能加载",
  remediation: "合规整改项暂时没能加载",
  compliance: "合规评审暂时没能加载",
};

export function useCargoReadyWorkbench(
  orderId: Ref<string>,
  taskId: Ref<string>,
) {
  const orders = ref<ReplenishmentOrderWorkbenchItem[]>([]);
  const nodeTasks = ref<NodeTaskDetail[]>([]);
  const remediationItems = ref<ExternalWorkItem[]>([]);
  const assessments = ref<CargoReadyComplianceAssessment[]>([]);
  const warnings = ref<WorkbenchProjectionWarning[]>([]);
  const queueLoading = shallowRef(false);
  const selectionLoading = shallowRef(false);
  const queueError = shallowRef("");
  const selectionError = shallowRef("");
  let selectionRevision = 0;

  const selectedOrder = computed(
    () => orders.value.find((order) => order.id === orderId.value) ?? null,
  );
  const queueItems = computed(() => buildCargoReadyOrderQueue(orders.value));
  const cargoReadyTasks = computed(() =>
    nodeTasks.value.filter((task) => task.nodeCode === "cargo_ready"),
  );
  const selectedTask = computed(
    () =>
      cargoReadyTasks.value.find((task) => task.id === taskId.value) ??
      cargoReadyTasks.value.find((task) => task.nextAction) ??
      cargoReadyTasks.value[0] ??
      null,
  );
  const complianceEvaluations = computed(() =>
    buildCargoReadyComplianceEvaluations(assessments.value),
  );
  const skuViews = computed(() =>
    selectedOrder.value
      ? buildCargoReadySkuViews(
          selectedOrder.value,
          complianceEvaluations.value,
        )
      : [],
  );

  watch(
    selectedOrder,
    (order, _previous, onCleanup) => {
      const revision = ++selectionRevision;
      onCleanup(() => {
        if (selectionRevision === revision) selectionRevision += 1;
      });
      void loadSelection(order, revision);
    },
    { immediate: true },
  );

  async function loadOrders(): Promise<void> {
    queueLoading.value = true;
    queueError.value = "";
    try {
      const page = await listReplenishmentOrders({ pageSize: 100 });
      orders.value = page.items;
    } catch {
      orders.value = [];
      queueError.value = "备货单暂时没能加载，请稍后重试";
    } finally {
      queueLoading.value = false;
    }
  }

  async function reloadSelection(): Promise<void> {
    const revision = ++selectionRevision;
    await loadSelection(selectedOrder.value, revision);
  }

  async function reloadWorkbench(): Promise<void> {
    await loadOrders();
    await reloadSelection();
  }

  async function loadSelection(
    order: ReplenishmentOrderWorkbenchItem | null,
    revision: number,
  ): Promise<void> {
    resetSelection();
    if (!order) return;
    const containerIds = order.relatedContainers.map(
      (container) => container.id,
    );
    if (containerIds.length === 0) return;
    selectionLoading.value = true;
    const projections = await Promise.all(
      containerIds.map(async (containerId) => {
        const [nodes, tasks, remediation, compliance] =
          await Promise.allSettled([
            listLifecycleNodes(containerId),
            listNodeTasks({ containerId, pageSize: 100 }),
            listExternalWorkItems({ containerId, pageSize: 100 }),
            getCargoReadyCompliance(containerId),
          ] as const);
        return { nodes, tasks, remediation, compliance };
      }),
    );
    if (revision !== selectionRevision) return;

    for (const projection of projections) {
      collectWarning(projection.nodes, "nodes");
      if (projection.tasks.status === "fulfilled") {
        nodeTasks.value.push(...projection.tasks.value.items);
      } else {
        addWarning("tasks");
      }
      if (projection.remediation.status === "fulfilled") {
        remediationItems.value.push(...projection.remediation.value.items);
      } else {
        addWarning("remediation");
      }
      if (
        projection.compliance.status === "fulfilled" &&
        projection.compliance.value
      ) {
        assessments.value.push(projection.compliance.value);
      } else if (projection.compliance.status === "rejected") {
        addWarning("compliance");
      }
    }
    selectionLoading.value = false;
  }

  function collectWarning(
    result: PromiseSettledResult<unknown>,
    code: WorkbenchProjectionWarning["code"],
  ): void {
    if (result.status === "rejected") addWarning(code);
  }

  function addWarning(code: WorkbenchProjectionWarning["code"]): void {
    if (warnings.value.some((warning) => warning.code === code)) return;
    warnings.value.push({ code, message: WARNING_MESSAGES[code] });
  }

  function resetSelection(): void {
    nodeTasks.value = [];
    remediationItems.value = [];
    assessments.value = [];
    warnings.value = [];
    selectionError.value = "";
    selectionLoading.value = false;
  }

  return {
    orders: readonly(orders),
    selectedOrder,
    queueItems,
    cargoReadyTasks,
    selectedTask,
    skuViews,
    complianceEvaluations,
    remediationItems: readonly(remediationItems),
    assessments: readonly(assessments),
    warnings: readonly(warnings),
    queueLoading: readonly(queueLoading),
    selectionLoading: readonly(selectionLoading),
    queueError: readonly(queueError),
    selectionError: readonly(selectionError),
    loadOrders,
    reloadSelection,
    reloadWorkbench,
  };
}
