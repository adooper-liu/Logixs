<script setup lang="ts">
import { ListTodo, Ship } from "@lucide/vue";
import { computed, type DeepReadonly } from "vue";
import type {
  ShipmentDetailV1,
  ShipmentPendingCompletionItemV1,
} from "@logix/contracts";

const props = defineProps<{
  selected: DeepReadonly<ShipmentPendingCompletionItemV1> | null;
  detail: DeepReadonly<ShipmentDetailV1> | null;
}>();

const shipment = computed(() => props.selected?.shipment ?? null);

const lifecycleLabel = computed(() => {
  const labels: Record<string, string> = {
    departed: "已出运",
    in_transit: "在途",
    arrived: "已到港",
    customs_clearance: "清关中",
    released: "已放行",
    picked_up: "已提柜",
    delivered_to_warehouse: "已送仓",
    empty_returned: "已还箱",
    closed: "已关闭",
  };
  return labels[shipment.value?.currentLifecycleStatus ?? ""] ?? "状态待确认";
});

const replenishmentOrders = computed(() =>
  uniqueValues(
    props.detail?.upstreamReferences
      .filter(({ referenceType }) => referenceType === "stocking_order")
      .map(({ sourceRecordId }) => sourceRecordId) ?? [],
  ),
);

const billNumbers = computed(() => {
  const documents = props.detail?.transportDocuments ?? [];
  const bills = documents.filter(({ documentType }) =>
    ["mbl", "hbl"].includes(documentType),
  );
  return uniqueValues(
    (bills.length ? bills : documents).map(({ documentNumber }) =>
      documentNumber.trim(),
    ),
  );
});

const containerTypes = computed(() =>
  uniqueValues(
    props.detail?.containers.map(({ containerTypeCode }) =>
      containerTypeCode?.trim(),
    ) ?? [],
  ),
);

const cargoMetrics = computed(() => {
  const allocations =
    props.detail?.containers.flatMap(({ allocations }) => allocations) ?? [];
  const packages = sumDecimal(
    allocations.map(({ packageCount }) => packageCount),
  );
  const weight = sumDecimal(allocations.map(({ grossWeight }) => grossWeight));
  const volume = sumDecimal(allocations.map(({ volume }) => volume));
  if (packages === null && weight === null && volume === null) return "待补";
  return [
    packages === null ? "件数待补" : `${formatNumber(packages)} 件`,
    weight === null ? "重量待补" : `${formatNumber(weight)} kg`,
    volume === null ? "体积待补" : `${formatNumber(volume)} m³`,
  ].join(" · ");
});

function uniqueValues(values: Array<string | null | undefined>): string {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].join("、");
}

function sumDecimal(values: readonly (string | null)[]): number | null {
  const numbers = values
    .filter((value): value is string => value !== null && value.trim() !== "")
    .map(Number)
    .filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "时间待补";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待补";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
</script>

<template>
  <div class="shipment-summary" aria-label="当前 Shipment 概览">
    <template v-if="shipment && selected">
      <header class="shipment-summary__header">
        <span>
          <small>当前 Shipment</small>
          <b>{{ shipment.shipmentNumber || "未编号 Shipment" }}</b>
        </span>
        <em>
          <ListTodo :size="15" aria-hidden="true" />
          {{ selected.pendingItems.length }} 项待补
        </em>
      </header>

      <section class="route-strip" aria-label="当前 Shipment 航线">
        <div class="route-port route-port--origin">
          <small>起运港</small>
          <b>{{ shipment.originUnlocode || "待补" }}</b>
          <span>{{ formatDateTime(shipment.atdAt) }} 离港</span>
        </div>

        <div class="route-progress">
          <span>
            <b>{{ lifecycleLabel }}</b>
            <small>
              {{ shipment.carrierCode || "船公司待补" }} ·
              {{ shipment.vesselName || "船名待补" }} /
              {{ shipment.voyageNumber || "航次待补" }}
            </small>
          </span>
          <div class="route-progress__track" aria-hidden="true">
            <i></i>
            <strong><Ship :size="18" /></strong>
            <i></i>
          </div>
        </div>

        <div class="route-port route-port--destination">
          <small>目的港</small>
          <b>{{ shipment.destinationUnlocode || "待补" }}</b>
          <span>{{ formatDateTime(shipment.etaAt) }} 预计到港</span>
        </div>
      </section>

      <section class="core-facts" aria-label="当前 Shipment 核心信息">
        <header class="core-facts__heading">
          <b>核心信息</b>
          <small>备货单 / 提单 / 船货 / 装载</small>
        </header>
        <dl class="core-facts__grid">
          <div>
            <dt>备货单</dt>
            <dd>{{ replenishmentOrders || "待补" }}</dd>
          </div>
          <div>
            <dt>提单</dt>
            <dd>{{ billNumbers || "待补" }}</dd>
          </div>
          <div>
            <dt>船名 / 航次</dt>
            <dd>
              {{ shipment.vesselName || "待补" }} /
              {{ shipment.voyageNumber || "待补" }}
            </dd>
          </div>
          <div>
            <dt>船公司</dt>
            <dd>{{ shipment.carrierCode || "待补" }}</dd>
          </div>
          <div>
            <dt>货主</dt>
            <dd>{{ shipment.cargoOwnerName || "待补" }}</dd>
          </div>
          <div>
            <dt>柜型</dt>
            <dd>{{ containerTypes || "待补" }}</dd>
          </div>
          <div>
            <dt>件 / 重 / 体</dt>
            <dd>{{ cargoMetrics }}</dd>
          </div>
          <div>
            <dt>SKU 明细</dt>
            <dd>
              {{
                shipment.activeCargoLineCount
                  ? `${shipment.activeCargoLineCount} 行`
                  : "未提供"
              }}
            </dd>
          </div>
        </dl>
      </section>
    </template>

    <div v-else class="shipment-summary__empty">
      <Ship :size="20" aria-hidden="true" />
      <span><small>当前 Shipment</small><b>请从左侧选择待补任务</b></span>
    </div>
  </div>
</template>

<style scoped>
.shipment-summary {
  min-width: 0;
}

.shipment-summary__header {
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.shipment-summary__header > span,
.shipment-summary__empty span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.shipment-summary small,
.route-port span,
.core-facts dt {
  color: var(--muted);
  font-size: var(--text-label);
}

.shipment-summary__header b {
  overflow-wrap: anywhere;
  font-size: var(--text-title);
}

.shipment-summary__header em {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-label);
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}

.route-strip {
  display: grid;
  grid-template-columns: minmax(88px, 0.8fr) minmax(150px, 1.5fr) minmax(
      88px,
      0.8fr
    );
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4);
  background: var(--surface-2);
}

.route-port {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.route-port b {
  overflow-wrap: anywhere;
  font-size: var(--text-title);
}

.route-port--destination {
  text-align: right;
}

.route-progress {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}

.route-progress > span {
  min-width: 0;
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
}

.route-progress > span b {
  color: var(--brand-strong);
  white-space: nowrap;
}

.route-progress > span small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-progress__track {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

.route-progress__track i {
  height: 2px;
  background: var(--line-strong);
}

.route-progress__track i:first-child {
  background: var(--brand);
}

.route-progress__track strong {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--brand-line);
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.core-facts {
  padding: var(--space-4);
}

.core-facts__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.core-facts__heading b {
  font-size: var(--text-title);
}

.core-facts__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4) var(--space-3);
  margin: 0;
}

.core-facts__grid div {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.core-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: var(--leading-body);
}

.shipment-summary__empty {
  min-height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--ink-soft);
}

@media (max-width: 1180px) {
  .core-facts__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .shipment-summary__header {
    align-items: flex-start;
  }

  .route-strip {
    grid-template-columns: 1fr 1fr;
  }

  .route-progress {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .core-facts__heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
