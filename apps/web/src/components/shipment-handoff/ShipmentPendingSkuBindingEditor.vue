<script setup lang="ts">
import { Link2, PackageSearch } from "@lucide/vue";
import { computed, type DeepReadonly } from "vue";
import type {
  ShipmentDetailV1,
  ShipmentPendingSkuBindingResultV1,
} from "@logix/contracts";
import type { ShipmentPendingSkuBindingDraft } from "../../composables/usePostDepartureHandoffWorkbench";

const props = defineProps<{
  detail: DeepReadonly<ShipmentDetailV1>;
  savingLineId: string;
  error: string;
  notice: string;
  result: DeepReadonly<ShipmentPendingSkuBindingResultV1> | null;
}>();

const emit = defineEmits<{
  bind: [draft: ShipmentPendingSkuBindingDraft];
}>();

const missingLines = computed(() =>
  props.detail.cargoLines.filter(({ productSkuId }) => !productSkuId),
);
</script>

<template>
  <section class="sku-binding" aria-label="匹配 SKU 主数据">
    <header>
      <PackageSearch :size="17" aria-hidden="true" />
      <span><small>货物身份</small><b>匹配 SKU 主数据</b></span>
    </header>

    <div class="sku-binding__head" aria-hidden="true">
      <span>当前 SKU</span><span>本票数量</span><span>主数据</span><span></span>
    </div>
    <div v-for="line in missingLines" :key="line.id" class="sku-binding__row">
      <b>{{ line.productNumber }}</b>
      <span>{{ line.quantity }} {{ line.quantityUnit }}</span>
      <span class="sku-binding__state">待匹配</span>
      <button
        name="skuBindingAction"
        type="button"
        :disabled="Boolean(savingLineId)"
        @click="
          emit('bind', {
            cargoLineId: line.id,
            expectedCargoLineVersion: line.version,
          })
        "
      >
        <Link2 :size="15" aria-hidden="true" />
        {{ savingLineId === line.id ? "处理中..." : "查找并绑定" }}
      </button>
    </div>

    <p v-if="error" class="sku-binding__error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="sku-binding__notice" role="status">
      {{ notice }}
    </p>
  </section>
</template>

<style scoped>
.sku-binding {
  display: grid;
  gap: var(--space-3);
}

.sku-binding header,
.sku-binding header span,
.sku-binding__head,
.sku-binding__row {
  display: grid;
  align-items: center;
}

.sku-binding header {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
}

.sku-binding header span {
  gap: var(--space-1);
}

.sku-binding small,
.sku-binding__head,
.sku-binding__row > span {
  color: var(--muted);
  font-size: var(--text-label);
}

.sku-binding__head,
.sku-binding__row {
  grid-template-columns: minmax(110px, 1.2fr) minmax(90px, 0.8fr) 74px auto;
  gap: var(--space-2);
}

.sku-binding__head {
  padding: 0 var(--space-2);
}

.sku-binding__row {
  min-height: 48px;
  padding: var(--space-2);
  border-top: 1px solid var(--line);
}

.sku-binding__state {
  color: var(--warn) !important;
}

.sku-binding button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--brand-strong);
  border-radius: var(--radius-control);
  background: var(--brand-strong);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.sku-binding button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.sku-binding__error {
  color: var(--risk);
}

.sku-binding__notice {
  color: var(--success);
}

@media (max-width: 620px) {
  .sku-binding__head {
    display: none;
  }

  .sku-binding__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .sku-binding__row button {
    grid-column: 1 / -1;
  }
}
</style>
