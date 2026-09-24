<script setup lang="ts">
import { ArrowUpRight, FileUp, PackageCheck } from "@lucide/vue";
import { computed, onMounted, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CargoReadyActionPanel from "../components/cargo-ready/CargoReadyActionPanel.vue";
import CargoReadySummary from "../components/cargo-ready/CargoReadySummary.vue";
import CargoReadyWorkQueue from "../components/cargo-ready/CargoReadyWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import { useCargoReadyWorkbench } from "../composables/useCargoReadyWorkbench";
import { useCargoReadyTaskOperation } from "../composables/useCargoReadyTaskOperation";
import type {
  CargoReadyQueueFilter,
  CargoReadyQueueItem,
} from "../data/cargoReadyWorkbench";

const route = useRoute();
const router = useRouter();
const orderId = computed(() => String(route.query.orderId ?? "").trim());
const legacyContainerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const queueFilter = shallowRef<CargoReadyQueueFilter>("mine");
const {
  orders,
  selectedOrder,
  queueItems,
  selectedTask,
  skuViews,
  remediationItems,
  warnings,
  queueLoading,
  selectionLoading,
  queueError,
  selectionError,
  loadOrders,
  reloadWorkbench,
} = useCargoReadyWorkbench(orderId, taskId);

const { submission, submitting, execute, retry } = useCargoReadyTaskOperation(
  selectedTask,
  reloadWorkbench,
);

watch(
  orders,
  (items) => {
    if (items.length === 0 || selectedOrder.value) return;
    const legacyMatch = legacyContainerId.value
      ? items.find((order) =>
          order.relatedContainers.some(
            (container) => container.id === legacyContainerId.value,
          ),
        )
      : null;
    void selectOrderById((legacyMatch ?? items[0]!).id);
  },
  { deep: false },
);

onMounted(() => {
  void loadOrders();
});

function selectOrder(item: CargoReadyQueueItem): void {
  void selectOrderById(item.order.id);
}

async function selectOrderById(value: string): Promise<void> {
  await router.replace({
    path: "/workspaces/cargo-ready",
    query: value ? { orderId: value } : {},
  });
}
</script>

<template>
  <RoleWorkbenchFrame
    title="备货工作台"
    summary="从备货单开始，只处理 SKU 身份、物料属性、适用资料和装柜分配的真实缺口。"
    workspace-label="备货"
    node-scope-label="备货确认"
    :containers="[]"
    selected-container-id=""
    :selected-container="null"
    :nodes="[]"
    :container-list-loading="false"
    :selection-loading="selectionLoading"
    container-list-error=""
    :selection-error="selectionError"
    :warnings="warnings"
    :context-ready="Boolean(selectedOrder)"
    :show-container-selector="false"
    empty-message="选择一张备货单查看物料事实、真实缺口和当前动作。"
    loading-message="正在加载关联货柜的备货、合规和任务事实…"
  >
    <template #actions>
      <router-link class="import-action" to="/import">
        <FileUp :size="16" aria-hidden="true" />导入备货单
      </router-link>
    </template>

    <template #context>
      <div v-if="selectedOrder" class="order-context">
        <span class="order-context__icon" aria-hidden="true">
          <PackageCheck :size="19" />
        </span>
        <span>
          <small>当前备货单</small>
          <b>{{ selectedOrder.orderNumber }}</b>
        </span>
        <span>
          <small>SKU</small>
          <b>{{ selectedOrder.lines.length }} 个</b>
        </span>
        <span>
          <small>需处理</small>
          <b
            >{{
              skuViews.filter((row) => row.overall === "attention").length
            }}
            个</b
          >
        </span>
        <span>
          <small>关联货柜</small>
          <b>
            {{
              selectedOrder.relatedContainers.length
                ? selectedOrder.relatedContainers
                    .map((item) => item.containerNumber ?? "待补箱号")
                    .join("、")
                : "尚未分配"
            }}
          </b>
        </span>
        <span class="handoff-destination">
          <small>Shipment 交接</small>
          <template v-if="selectedOrder.handoffShipments?.length">
            <router-link
              v-for="shipment in selectedOrder.handoffShipments ?? []"
              :key="shipment.id"
              :to="`/workspaces/dispatch?shipmentId=${shipment.id}`"
            >
              {{ shipment.shipmentNumber ?? shipment.id.slice(0, 8) }}
              <ArrowUpRight :size="13" aria-hidden="true" />
            </router-link>
          </template>
          <b v-else>尚未交接</b>
        </span>
      </div>
    </template>

    <template #queue>
      <CargoReadyWorkQueue
        :items="queueItems"
        :selected-order-id="selectedOrder?.id ?? orderId"
        :filter="queueFilter"
        :loading="queueLoading"
        :error="queueError"
        @select="selectOrder"
        @change-filter="queueFilter = $event"
      />
    </template>

    <template #primary>
      <CargoReadySummary
        v-if="selectedOrder"
        :order="selectedOrder"
        :sku-views="skuViews"
      />
    </template>

    <template #secondary>
      <CargoReadyActionPanel
        v-if="selectedOrder"
        :order="selectedOrder"
        :task="selectedTask"
        :remediation-items="remediationItems"
        :submission="submission"
        :submitting="submitting"
        @execute="execute()"
        @retry="retry()"
      />
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.import-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-size: var(--text-label);
  font-weight: var(--weight-page);
  text-decoration: none;
}

.order-context {
  min-width: 0;
  display: grid;
  grid-column: 2 / -1;
  grid-template-columns: 36px minmax(130px, 1.2fr) repeat(
      4,
      minmax(88px, 0.7fr)
    );
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
}

.order-context > span:not(.order-context__icon) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.order-context small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.order-context b {
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}

.handoff-destination a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--brand-strong);
  font-size: var(--text-meta);
  font-weight: var(--weight-page);
  text-decoration: none;
}

.order-context__icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

@media (max-width: 900px) {
  .order-context {
    grid-column: 1 / -1;
    grid-template-columns: 36px repeat(2, minmax(0, 1fr));
    border-top: 1px solid var(--line);
  }

  .order-context > span:last-child {
    grid-column: 2 / -1;
  }
}

@media (max-width: 560px) {
  .order-context {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .order-context > span:not(.order-context__icon) {
    grid-column: 2;
  }
}
</style>
