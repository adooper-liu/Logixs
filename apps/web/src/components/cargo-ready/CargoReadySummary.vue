<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  PackageCheck,
} from "@lucide/vue";
import { computed, shallowRef } from "vue";
import type { ReplenishmentOrderWorkbenchItem } from "../../api/replenishmentOrders";
import type { CargoReadySkuView } from "../../data/cargoReadyWorkbench";

const props = defineProps<{
  order: ReplenishmentOrderWorkbenchItem;
  skuViews: readonly CargoReadySkuView[];
}>();

const showReady = shallowRef(false);
const attentionRows = computed(() =>
  props.skuViews.filter((row) => row.overall === "attention"),
);
const readyRows = computed(() =>
  props.skuViews.filter((row) => row.overall === "ready"),
);

function allocationLabel(row: CargoReadySkuView): string {
  if (row.line.allocations.length === 0) return "尚未分配货柜";
  if (row.line.allocations.length === 1) {
    const allocation = row.line.allocations[0]!;
    return `已分配至 ${allocation.containerNumber ?? "货柜号待补充"}`;
  }
  return `已分配至 ${row.line.allocations.length} 个货柜`;
}
</script>

<template>
  <div class="cargo-summary">
    <header class="panel-header">
      <span class="panel-icon" aria-hidden="true">
        <PackageCheck :size="18" />
      </span>
      <span>
        <small>已知事实与真实缺口</small>
        <h2>{{ order.orderNumber }}</h2>
      </span>
      <b>{{ attentionRows.length }} 个需处理</b>
    </header>

    <section v-if="attentionRows.length" aria-label="需要处理的 SKU">
      <article
        v-for="row in attentionRows"
        :key="row.line.id"
        class="sku-row sku-row--attention"
      >
        <header class="sku-heading">
          <span>
            <b>SKU {{ row.line.productNumber }}</b>
            <small>
              {{ row.line.shippedQuantity }} {{ row.line.quantityUnit }} ·
              {{ allocationLabel(row) }}
            </small>
          </span>
          <em><AlertCircle :size="14" />需要处理</em>
        </header>

        <p class="attribute-line">
          <span v-for="attribute in row.attributeSummary" :key="attribute">
            {{ attribute }}
          </span>
        </p>

        <section v-if="row.requirements.length" class="requirements">
          <small>本次适用资料</small>
          <ul>
            <li
              v-for="requirement in row.requirements"
              :key="`${requirement.certificateType}:${requirement.reason}`"
            >
              <span>{{ requirement.label }}</span>
              <b :class="`requirement--${requirement.status}`">
                {{
                  requirement.status === "verified" ? "已核验" : "缺失或无效"
                }}
              </b>
              <small>{{ requirement.reason }}</small>
            </li>
          </ul>
        </section>

        <section class="gap-list" aria-label="当前缺口">
          <small>只需处理以下缺口</small>
          <ul>
            <li v-for="gap in row.gaps" :key="gap.code">
              <b>{{ gap.label }}</b>
              <span v-if="gap.detail">{{ gap.detail }}</span>
            </li>
          </ul>
        </section>
      </article>
    </section>

    <p v-else class="all-ready">
      <CheckCircle2 :size="16" aria-hidden="true" />
      当前备货单没有物料属性或适用资料缺口。
    </p>

    <section
      v-if="readyRows.length"
      class="ready-group"
      aria-label="已齐备 SKU"
    >
      <button
        type="button"
        class="ready-toggle"
        :aria-expanded="showReady"
        @click="showReady = !showReady"
      >
        <span>
          <CheckCircle2 :size="16" aria-hidden="true" />
          已齐备 {{ readyRows.length }} 个 SKU
        </span>
        <ChevronDown
          :size="16"
          :class="{ rotated: showReady }"
          aria-hidden="true"
        />
      </button>

      <div v-if="showReady" class="ready-list">
        <article v-for="row in readyRows" :key="row.line.id" class="sku-row">
          <header class="sku-heading">
            <span>
              <b>SKU {{ row.line.productNumber }}</b>
              <small>
                {{ row.line.shippedQuantity }} {{ row.line.quantityUnit }} ·
                {{ allocationLabel(row) }}
              </small>
            </span>
          </header>
          <p class="attribute-line">
            <span v-for="attribute in row.attributeSummary" :key="attribute">
              {{ attribute }}
            </span>
          </p>
          <p class="requirement-summary">{{ row.requirementSummary }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cargo-summary {
  min-width: 0;
}

.panel-header {
  min-height: 58px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-header > span:not(.panel-icon) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.panel-header h2 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-title);
}

.panel-header small,
.sku-heading small,
.requirements > small,
.requirements li small,
.gap-list > small,
.gap-list li span {
  color: var(--muted);
  font-size: var(--text-micro);
}

.panel-header > b {
  color: var(--risk);
  font-size: var(--text-label);
}

.panel-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.sku-row {
  min-width: 0;
  border-bottom: 1px solid var(--line);
}

.sku-row--attention {
  box-shadow: inset 3px 0 var(--warn);
}

.sku-heading {
  min-width: 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
}

.sku-heading > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sku-heading b {
  overflow-wrap: anywhere;
  font-size: var(--text-label);
}

.sku-heading em {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--warn);
  font-size: var(--text-micro);
  font-style: normal;
  font-weight: 700;
}

.attribute-line {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  padding: 0 var(--space-3) var(--space-3);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.attribute-line span:not(:last-child)::after {
  content: "·";
  margin-left: var(--space-3);
  color: var(--muted);
}

.requirements,
.gap-list {
  padding: var(--space-3);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.requirements ul,
.gap-list ul {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.requirements li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-1) var(--space-3);
  font-size: var(--text-micro);
}

.requirements li small {
  grid-column: 1 / -1;
}

.requirement--verified {
  color: var(--ok);
}

.requirement--missing_or_invalid,
.gap-list li b {
  color: var(--risk);
}

.gap-list li {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-micro);
}

.all-ready {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-4) var(--space-3);
  color: var(--ok);
  font-size: var(--text-label);
}

.ready-group {
  border-top: 1px solid var(--line-strong);
}

.ready-toggle {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 0;
  background: var(--ok-bg);
  color: var(--ok);
  font-size: var(--text-label);
  font-weight: 700;
  cursor: pointer;
}

.ready-toggle > span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.ready-toggle svg {
  transition: transform 120ms ease;
}

.ready-toggle svg.rotated {
  transform: rotate(180deg);
}

.ready-list {
  display: grid;
}

.requirement-summary {
  margin: 0;
  padding: 0 var(--space-3) var(--space-3);
  color: var(--ok);
  font-size: var(--text-micro);
}

@media (prefers-reduced-motion: reduce) {
  .ready-toggle svg {
    transition: none;
  }
}

@media (max-width: 560px) {
  .panel-header {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .panel-header > b {
    grid-column: 2;
  }
}
</style>
