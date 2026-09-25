<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleX,
  RefreshCw,
} from "@lucide/vue";
import type { DeepReadonly } from "vue";
import type {
  InternalShipmentHandoffBatchAcceptResultV1,
  PostDepartureSourcePackageAcceptResultV1,
} from "@logix/contracts";

defineProps<{
  result: DeepReadonly<
    | PostDepartureSourcePackageAcceptResultV1
    | InternalShipmentHandoffBatchAcceptResultV1
  >;
}>();

const emit = defineEmits<{
  reviewCandidate: [candidateRef: string];
  retryPackage: [];
}>();

const STATUS_LABELS = {
  accepted: "接管成功",
  duplicate: "已接管",
  conflict: "业务冲突",
  rejected: "业务拒绝",
  failed: "技术失败",
} as const;
</script>

<template>
  <section class="batch-receipt" aria-label="批量接管逐票结果">
    <header>
      <CheckCircle2 :size="17" aria-hidden="true" />
      <span>
        <b>批量接管已完成</b>
        <small>
          {{ result.totals.accepted }} 票新接管 ·
          {{ result.totals.duplicate }} 票已存在 ·
          {{ result.totals.conflict }} 票冲突 ·
          {{ result.totals.rejected }} 票拒绝 ·
          {{ result.totals.failed }} 票失败
        </small>
      </span>
    </header>

    <ul>
      <li v-for="item in result.items" :key="item.traceId">
        <AlertTriangle
          v-if="item.status === 'conflict' || item.status === 'rejected'"
          :size="16"
          aria-hidden="true"
        />
        <CircleX
          v-else-if="item.status === 'failed'"
          :size="16"
          aria-hidden="true"
        />
        <CheckCircle2 v-else :size="16" aria-hidden="true" />

        <span class="batch-receipt__identity">
          <b>{{ item.candidateRefs.join("、") }}</b>
          <small>
            {{ STATUS_LABELS[item.status] }}
            <template v-if="item.errorCode"> · {{ item.errorCode }}</template>
          </small>
          <small>追踪号 {{ item.traceId }}</small>
        </span>

        <RouterLink
          v-if="item.recoveryAction === 'open_shipment' && item.shipmentId"
          :to="`/workspaces/dispatch?shipmentId=${item.shipmentId}`"
        >
          打开 Shipment
          <ArrowRight :size="14" aria-hidden="true" />
        </RouterLink>
        <button
          v-else-if="item.recoveryAction === 'review_candidate'"
          type="button"
          data-action="review-candidate"
          @click="emit('reviewCandidate', item.candidateRefs[0]!)"
        >
          核对候选
          <ArrowRight :size="14" aria-hidden="true" />
        </button>
        <button
          v-else
          type="button"
          data-action="retry-package"
          @click="emit('retryPackage')"
        >
          重试
          <RefreshCw :size="14" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.batch-receipt {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--brand);
  background: var(--brand-soft);
}

.batch-receipt > header,
.batch-receipt > header > span,
.batch-receipt li,
.batch-receipt__identity {
  display: flex;
}

.batch-receipt > header,
.batch-receipt li {
  align-items: flex-start;
  gap: var(--space-2);
}

.batch-receipt > header > span,
.batch-receipt__identity {
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
}

.batch-receipt ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.batch-receipt li {
  padding-top: var(--space-2);
  border-top: 1px solid var(--brand-line);
}

.batch-receipt small {
  color: var(--muted);
  font-size: var(--text-label);
  overflow-wrap: anywhere;
}

.batch-receipt a,
.batch-receipt button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--brand-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

@media (max-width: 680px) {
  .batch-receipt li {
    flex-wrap: wrap;
  }

  .batch-receipt a,
  .batch-receipt button {
    width: 100%;
  }
}
</style>
