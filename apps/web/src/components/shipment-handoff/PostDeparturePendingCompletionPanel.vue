<script setup lang="ts">
import { ArrowRight, RefreshCw, Ship } from "@lucide/vue";
import {
  computed,
  nextTick,
  shallowRef,
  useTemplateRef,
  watch,
  type DeepReadonly,
} from "vue";
import type {
  ShipmentDetailV1,
  ShipmentPendingCompletionItemV1,
  ShipmentPendingCargoCompletionResultV1,
  ShipmentPendingFactCompletionResultV1,
  ShipmentPendingSkuBindingResultV1,
  ShipmentPendingDocumentCompletionResultV1,
} from "@logix/contracts";
import type {
  ShipmentPendingCargoLineDraft,
  ShipmentPendingDocumentDraft,
  ShipmentPendingFactDraft,
  ShipmentPendingSkuBindingDraft,
} from "../../composables/usePostDepartureHandoffWorkbench";
import ShipmentPendingCargoEditor from "./ShipmentPendingCargoEditor.vue";
import ShipmentPendingDocumentEditor from "./ShipmentPendingDocumentEditor.vue";
import ShipmentPendingFactsEditor from "./ShipmentPendingFactsEditor.vue";
import ShipmentPendingItemRow from "./ShipmentPendingItemRow.vue";
import ShipmentPendingSkuBindingEditor from "./ShipmentPendingSkuBindingEditor.vue";

const props = defineProps<{
  items: readonly DeepReadonly<ShipmentPendingCompletionItemV1>[];
  selected: DeepReadonly<ShipmentPendingCompletionItemV1> | null;
  loading: boolean;
  error: string;
  savingFacts: boolean;
  saveError: string;
  saveNotice: string;
  saveResult: DeepReadonly<ShipmentPendingFactCompletionResultV1> | null;
  detail: DeepReadonly<ShipmentDetailV1> | null;
  loadingDetail: boolean;
  detailError: string;
  savingCargo: boolean;
  cargoError: string;
  cargoNotice: string;
  cargoResult: DeepReadonly<ShipmentPendingCargoCompletionResultV1> | null;
  bindingSkuLineId: string;
  skuBindingError: string;
  skuBindingNotice: string;
  skuBindingResult: DeepReadonly<ShipmentPendingSkuBindingResultV1> | null;
  savingDocuments: boolean;
  documentError: string;
  documentNotice: string;
  documentResult: DeepReadonly<ShipmentPendingDocumentCompletionResultV1> | null;
}>();

const emit = defineEmits<{
  select: [shipmentId: string];
  refresh: [];
  saveFacts: [draft: ShipmentPendingFactDraft];
  saveCargo: [lines: ShipmentPendingCargoLineDraft[]];
  bindSku: [draft: ShipmentPendingSkuBindingDraft];
  saveDocuments: [documents: ShipmentPendingDocumentDraft[]];
}>();

const editorSection = useTemplateRef<HTMLElement>("editorSection");
const activeEditor = shallowRef<"facts" | "cargo" | "sku" | "document" | null>(
  null,
);
const CORE_FACT_CODES = new Set([
  "carrier_missing",
  "vessel_voyage_missing",
  "origin_port_missing",
  "destination_port_missing",
  "departure_proof_missing",
]);
const hasCorePending = computed(() =>
  props.selected?.pendingItems.some(({ code }) => CORE_FACT_CODES.has(code)),
);
const hasCargoPending = computed(() =>
  props.selected?.pendingItems.some(
    ({ code }) => code === "cargo_detail_missing",
  ),
);
const hasSkuPending = computed(() =>
  props.selected?.pendingItems.some(
    ({ code }) => code === "product_sku_missing",
  ),
);
const hasDocumentPending = computed(() =>
  props.selected?.pendingItems.some(
    ({ code }) => code === "bill_of_lading_missing",
  ),
);

watch(
  () =>
    `${props.selected?.shipment.id ?? ""}:${props.selected?.pendingItems
      .map(({ code, subjectRef }) => `${code}:${subjectRef}`)
      .join("|")}`,
  () => {
    activeEditor.value = hasCorePending.value
      ? "facts"
      : hasCargoPending.value
        ? "cargo"
        : hasSkuPending.value
          ? "sku"
          : hasDocumentPending.value
            ? "document"
            : null;
  },
  { immediate: true },
);

async function focusEditor(code: string): Promise<void> {
  activeEditor.value =
    code === "cargo_detail_missing"
      ? "cargo"
      : code === "product_sku_missing"
        ? "sku"
        : code === "bill_of_lading_missing"
          ? "document"
          : "facts";
  const inputName =
    {
      carrier_missing: "carrierCode",
      vessel_voyage_missing: "vesselName",
      origin_port_missing: "originPortCode",
      destination_port_missing: "destinationPortCode",
      departure_proof_missing: "departureLocal",
      cargo_detail_missing: "cargoProductNumber",
      product_sku_missing: "skuBindingAction",
      bill_of_lading_missing: "documentNumber",
    }[code] ?? "carrierCode";
  await nextTick();
  editorSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  editorSection.value
    ?.querySelector<HTMLInputElement>(`[name="${inputName}"]`)
    ?.focus();
}
</script>

<template>
  <section class="pending-work" aria-label="已接管待补任务">
    <header class="pending-work__heading">
      <span>
        <small>持续作业队列</small>
        <b>已接管待补</b>
      </span>
      <button type="button" :disabled="loading" @click="emit('refresh')">
        <RefreshCw :size="15" aria-hidden="true" />
        {{ loading ? "刷新中..." : "刷新" }}
      </button>
    </header>

    <p v-if="error" class="pending-work__error" role="alert">{{ error }}</p>
    <p v-else-if="!loading && items.length === 0" class="pending-work__empty">
      当前没有待补任务。
    </p>

    <div v-else class="pending-work__grid">
      <section
        class="pending-block pending-queue"
        aria-label="待补 Shipment 队列"
      >
        <header>
          <small>任务队列</small><b>{{ items.length }} 票待补</b>
        </header>
        <button
          v-for="item in items"
          :key="item.shipment.id"
          type="button"
          :class="{
            'pending-queue__item--active':
              selected?.shipment.id === item.shipment.id,
          }"
          @click="emit('select', item.shipment.id)"
        >
          <span>
            <Ship :size="16" aria-hidden="true" />
            <b>{{ item.shipment.shipmentNumber || "未编号 Shipment" }}</b>
          </span>
          <small>
            {{ item.shipment.originUnlocode || "起运港待补" }} →
            {{ item.shipment.destinationUnlocode || "目的港待补" }}
          </small>
          <em>{{ item.pendingItems.length }} 项待补</em>
        </button>
      </section>

      <section
        class="pending-block pending-facts"
        aria-label="当前 Shipment 待补事实"
      >
        <header>
          <small>当前 Shipment</small
          ><b>{{ selected?.shipment.shipmentNumber || "请选择任务" }}</b>
        </header>
        <template v-if="selected">
          <dl>
            <div>
              <dt>航线</dt>
              <dd>
                {{ selected.shipment.originUnlocode || "待补" }} →
                {{ selected.shipment.destinationUnlocode || "待补" }}
              </dd>
            </div>
            <div>
              <dt>船名航次</dt>
              <dd>
                {{ selected.shipment.vesselName || "待补" }} /
                {{ selected.shipment.voyageNumber || "待补" }}
              </dd>
            </div>
            <div>
              <dt>货柜</dt>
              <dd>{{ selected.shipment.activeContainerCount }} 只</dd>
            </div>
          </dl>
          <ul>
            <ShipmentPendingItemRow
              v-for="pending in selected.pendingItems"
              :key="`${pending.code}:${pending.subjectRef}`"
              :item="pending"
              @act="focusEditor"
            />
          </ul>
        </template>
      </section>

      <section
        ref="editorSection"
        class="pending-block pending-actions"
        aria-label="待补处理动作"
      >
        <header><small>下一步</small><b>继续补全</b></header>
        <ShipmentPendingFactsEditor
          v-if="selected && hasCorePending && activeEditor === 'facts'"
          :selected="selected"
          :saving="savingFacts"
          :error="saveError"
          :notice="saveNotice"
          :result="saveResult"
          @save="emit('saveFacts', $event)"
        />
        <p v-else-if="loadingDetail">正在读取当前 Shipment 货柜...</p>
        <p v-else-if="detailError" class="pending-work__error" role="alert">
          {{ detailError }}
        </p>
        <ShipmentPendingCargoEditor
          v-else-if="
            selected && detail && hasCargoPending && activeEditor === 'cargo'
          "
          :detail="detail"
          :saving="savingCargo"
          :error="cargoError"
          :notice="cargoNotice"
          :result="cargoResult"
          @save="emit('saveCargo', $event)"
        />
        <ShipmentPendingSkuBindingEditor
          v-else-if="
            selected && detail && hasSkuPending && activeEditor === 'sku'
          "
          :detail="detail"
          :saving-line-id="bindingSkuLineId"
          :error="skuBindingError"
          :notice="skuBindingNotice"
          :result="skuBindingResult"
          @bind="emit('bindSku', $event)"
        />
        <ShipmentPendingDocumentEditor
          v-else-if="
            selected &&
            detail &&
            hasDocumentPending &&
            activeEditor === 'document'
          "
          :detail="detail"
          :saving="savingDocuments"
          :error="documentError"
          :notice="documentNotice"
          :result="documentResult"
          @save="emit('saveDocuments', $event)"
        />
        <p v-else>
          可先推进不依赖这些资料的工作；需要时直接进入当前 Shipment 补全。
        </p>
        <RouterLink
          v-if="
            selected &&
            !hasCorePending &&
            !hasCargoPending &&
            !hasSkuPending &&
            !hasDocumentPending
          "
          :to="`/workspaces/dispatch?shipmentId=${selected.shipment.id}&focus=${selected.pendingItems[0]?.code ?? ''}`"
        >
          打开当前 Shipment
          <ArrowRight :size="16" aria-hidden="true" />
        </RouterLink>
      </section>
    </div>
  </section>
</template>

<style scoped>
.pending-work {
  margin-top: var(--space-3);
}

.pending-work__heading,
.pending-block header,
.pending-queue > button span {
  display: flex;
  align-items: center;
}

.pending-work__heading {
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.pending-work__heading span,
.pending-block header {
  display: grid;
  gap: var(--space-1);
}

.pending-work small,
.pending-block p,
.pending-block dt {
  color: var(--muted);
  font-size: var(--text-label);
}

.pending-work__heading button,
.pending-actions a {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.pending-work__grid {
  display: grid;
  grid-template-columns: minmax(240px, 0.75fr) minmax(360px, 1.5fr) minmax(
      240px,
      0.75fr
    );
  gap: var(--space-4);
  align-items: start;
}

.pending-block {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.pending-queue {
  display: grid;
  gap: var(--space-2);
}

.pending-queue > button {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.pending-queue__item--active {
  border-color: var(--brand-line) !important;
  background: var(--brand-soft) !important;
  box-shadow: inset 3px 0 0 var(--brand);
}

.pending-queue > button span {
  gap: var(--space-2);
}

.pending-queue > button em {
  color: var(--warn);
  font-size: var(--text-label);
  font-style: normal;
}

.pending-facts dl,
.pending-facts ul,
.pending-actions {
  display: grid;
  gap: var(--space-3);
}

.pending-facts dl {
  margin: var(--space-4) 0;
}

.pending-facts dl div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: var(--space-2);
}

.pending-facts dd {
  margin: 0;
}

.pending-facts ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pending-actions p {
  margin: var(--space-3) 0 0;
}

.pending-actions a {
  border-color: var(--brand-strong);
  background: var(--brand-strong);
  color: white;
}

.pending-work__error {
  color: var(--risk);
}

.pending-work__empty {
  padding: var(--space-5);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  text-align: center;
}

@media (max-width: 960px) {
  .pending-work__grid {
    grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
  }

  .pending-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 680px) {
  .pending-work__grid {
    grid-template-columns: 1fr;
  }

  .pending-actions {
    grid-column: auto;
  }
}
</style>
