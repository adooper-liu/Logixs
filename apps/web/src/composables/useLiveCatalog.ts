import { ref } from "vue";
import { listClientOperations } from "../api/clientOperations";
import { listContainers } from "../api/containers";
import { listCurrentNodes } from "../api/lifecycleCurrentNodes";
import { listLifecycleNodesByContainers } from "../api/lifecycleNodes";
import { listNodeTasks } from "../api/nodeTasks";
import { attachLatestSync } from "../data/clientOperationQueueContract";
import {
  attachCurrentNodes,
  attachLiveNodes,
  attachOpenTasks,
  toLiveContainer,
} from "../data/liveWorkspaceProjection";
import type { ContainerProjection } from "../data/sample";

export function useLiveCatalog() {
  const containers = ref<ContainerProjection[]>([]);
  const loading = ref(true);
  const error = ref("");
  const tasksReady = ref(false);
  const stationsReady = ref(false);
  const syncReady = ref(false);
  const railsReady = ref(false);

  const reload = async () => {
    loading.value = true;
    error.value = "";
    tasksReady.value = false;
    stationsReady.value = false;
    syncReady.value = false;
    railsReady.value = false;
    try {
      const page = await listContainers({ pageSize: 200 });
      let rows = page.items.map(toLiveContainer);
      const ids = page.items.map((item) => item.id);
      const extras = await Promise.allSettled([
        listNodeTasks({ pageSize: 200 }),
        ids.length > 0
          ? listCurrentNodes(ids)
          : Promise.resolve({
              items: [],
              asOf: "",
              projectionVersion: 0,
            }),
        listClientOperations({ pageSize: 200 }),
        ids.length > 0
          ? listLifecycleNodesByContainers(ids)
          : Promise.resolve({
              items: [],
              asOf: "",
              projectionVersion: 0,
            }),
      ]);
      const tasks = extras[0];
      const stations = extras[1];
      const operations = extras[2];
      const rails = extras[3];
      if (tasks.status === "fulfilled") {
        rows = attachOpenTasks(rows, tasks.value.items);
        tasksReady.value = true;
      }
      if (stations.status === "fulfilled") {
        rows = attachCurrentNodes(rows, stations.value.items);
        stationsReady.value = true;
      }
      if (operations.status === "fulfilled") {
        const hints =
          tasks.status === "fulfilled"
            ? tasks.value.items.flatMap((task) => {
                const containerId = task.containerId?.trim() ?? "";
                if (!containerId) return [];
                return [
                  {
                    containerId,
                    taskId: task.id,
                    workOrderIds: task.workOrders.map((item) => item.id),
                  },
                ];
              })
            : [];
        rows = attachLatestSync(rows, operations.value.items, hints);
        syncReady.value = true;
      }
      if (rails.status === "fulfilled") {
        rows = attachLiveNodes(rows, rails.value.items);
        railsReady.value = true;
      }
      containers.value = rows;
    } catch (cause) {
      containers.value = [];
      error.value =
        cause instanceof Error ? cause.message : "加载失败，请确认 API 已启动";
    } finally {
      loading.value = false;
    }
  };

  const findById = (id: string) =>
    containers.value.find((row) => row.containerRecordId === id);

  return {
    containers,
    loading,
    error,
    tasksReady,
    stationsReady,
    syncReady,
    railsReady,
    reload,
    findById,
  };
}
