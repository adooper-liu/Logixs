<script setup lang="ts">
import { ArrowRight, CheckCircle2, X } from "@lucide/vue";
import type { MarketSignalOperationReceipt } from "../../data/marketSignalScenarios";

defineProps<{ receipt: MarketSignalOperationReceipt }>();

const emit = defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <section class="operation-receipt" role="status" aria-label="处理结果">
    <CheckCircle2 :size="20" aria-hidden="true" />
    <div class="receipt-main">
      <small>{{ receipt.signalTitle }}</small>
      <b>{{ receipt.result.statusLabel }}</b>
      <p>{{ receipt.result.message }}</p>
    </div>
    <div class="receipt-details">
      <span
        ><small>下一责任</small><b>{{ receipt.result.nextOwner }}</b></span
      >
      <span v-if="receipt.result.handoffFacts.length">
        <small>已交出</small>
        <b>{{ receipt.result.handoffFacts.join("；") }}</b>
      </span>
      <span v-if="receipt.result.pendingItems.length">
        <small>仍待补</small>
        <b>{{ receipt.result.pendingItems.join("；") }}</b>
      </span>
    </div>
    <RouterLink
      v-if="
        receipt.result.decision === 'handoff' &&
        receipt.result.completion === 'completed'
      "
      to="/workspaces/product-selection"
    >
      查看选品队列 <ArrowRight :size="14" aria-hidden="true" />
    </RouterLink>
    <button type="button" aria-label="关闭处理结果" @click="emit('dismiss')">
      <X :size="17" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.operation-receipt {
  min-width: 0;
  display: grid;
  grid-template-columns:
    auto minmax(170px, 0.8fr) minmax(260px, 1.4fr)
    auto auto;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--ok);
  background: var(--ok-bg);
}

.operation-receipt > svg {
  color: var(--ok);
}

.receipt-main,
.receipt-main span,
.receipt-details span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.receipt-main small,
.receipt-details small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.receipt-main b,
.receipt-details b {
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-label);
}

.receipt-main p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.receipt-details {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.operation-receipt a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.operation-receipt > button {
  width: var(--touch-target);
  height: var(--touch-target);
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.operation-receipt a:focus-visible,
.operation-receipt > button:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

@media (max-width: 900px) {
  .operation-receipt {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
  }

  .receipt-details {
    grid-column: 2 / -1;
  }

  .operation-receipt a {
    grid-column: 2;
  }
}

@media (max-width: 680px) {
  .receipt-details {
    grid-template-columns: 1fr;
  }
}
</style>
