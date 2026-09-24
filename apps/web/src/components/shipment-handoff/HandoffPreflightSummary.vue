<script setup lang="ts">
import { CheckCircle2, RefreshCw } from "@lucide/vue";
import type {
  PostDepartureSourcePackagePreflightResultV1,
  PostDepartureSourcePackageReviewResultV1,
} from "../../api/postDepartureSourcePackages";

defineProps<{
  result: PostDepartureSourcePackagePreflightResultV1;
  preflighting: boolean;
  reviewReceipt: PostDepartureSourcePackageReviewResultV1 | null;
  reviewSaveError: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <section class="preflight-summary" aria-label="预检结果与下一步">
    <header class="pane-heading">
      <span>
        <small>本次结果</small>
        <b>{{ result.totals.containers }} 柜已完成联合检查</b>
      </span>
    </header>

    <dl class="totals">
      <div>
        <dt>可接管</dt>
        <dd class="total--ready">{{ result.totals.ready }}</dd>
      </div>
      <div>
        <dt>待补资料</dt>
        <dd class="total--review">{{ result.totals.reviewRequired }}</dd>
      </div>
      <div>
        <dt>不能接管</dt>
        <dd class="total--rejected">{{ result.totals.rejected }}</dd>
      </div>
    </dl>

    <div class="receipt-state">
      <CheckCircle2 :size="17" aria-hidden="true" />
      <span>
        <b>{{ reviewReceipt ? "补全记录已建立" : "来源与预检结果已留存" }}</b>
        <small>
          {{
            reviewReceipt
              ? `${reviewReceipt.candidateCount} 柜可直接补齐`
              : `${result.sources.length} 份文件可追溯`
          }}
        </small>
      </span>
      <button
        type="button"
        class="retry-action"
        :disabled="preflighting"
        aria-label="重新预检"
        title="重新预检"
        @click="emit('retry')"
      >
        <RefreshCw :size="16" aria-hidden="true" />
      </button>
    </div>

    <div v-if="reviewSaveError" class="next-action">
      <p v-if="reviewSaveError" class="save-error" role="alert">
        {{ reviewSaveError }}
      </p>
    </div>

    <p class="trace">追踪号 {{ reviewReceipt?.traceId ?? result.traceId }}</p>
  </section>
</template>

<style scoped>
.preflight-summary {
  min-width: 0;
}

.pane-heading {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pane-heading > span {
  display: grid;
  gap: var(--space-1);
}

.pane-heading small,
.totals dt,
.receipt-state small,
.trace {
  color: var(--muted);
  font-size: var(--text-micro);
}

.totals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  gap: var(--space-2);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.totals > div {
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-2);
  text-align: center;
}

.totals dt {
  margin-bottom: var(--space-1);
}

.totals dd {
  margin: 0;
  font-size: var(--text-page);
  font-weight: var(--weight-page);
}

.total--ready {
  color: var(--brand-strong);
}

.total--review {
  color: var(--warn);
}

.total--rejected {
  color: var(--risk);
}

.receipt-state {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-4);
  color: var(--brand-strong);
}

.receipt-state span {
  display: grid;
  gap: var(--space-1);
}

.next-action {
  padding: var(--space-4);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.retry-action {
  width: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font-weight: var(--weight-strong);
  cursor: pointer;
}

.save-error {
  margin: 0;
  color: var(--risk);
  font-size: var(--text-meta);
}

.retry-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.trace {
  margin: 0;
  padding: 0 var(--space-4) var(--space-4);
  overflow-wrap: anywhere;
}
</style>
