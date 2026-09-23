<script setup lang="ts">
import type {
  LifecycleDateFactReviewItem,
  LifecycleDateFactResult,
} from "@logix/contracts";
import { CheckCircle2, RefreshCw } from "@lucide/vue";
import type { DeepReadonly } from "vue";

defineProps<{
  item: DeepReadonly<LifecycleDateFactReviewItem> | null;
  submitting: boolean;
  result: DeepReadonly<LifecycleDateFactResult> | null;
}>();
const emit = defineEmits<{ approve: []; refresh: [] }>();

const reasonLabels: Record<string, string> = {
  SELF_REVIEW_NOT_ALLOWED: "录入人与复核人相同，必须换一名复核人。",
  SUBMITTER_IDENTITY_MISSING: "原声明缺少录入人身份，不能执行四眼审批。",
  EVIDENCE_REQUIRED: "实际日期缺少证据。",
  EVIDENCE_NOT_QUALIFIED: "证据尚未全部核验为有效。",
};
</script>

<template>
  <section class="action-panel" aria-labelledby="review-action-title">
    <div class="heading">
      <div>
        <p class="eyebrow">允许动作</p>
        <h2 id="review-action-title">复核决定</h2>
      </div>
      <button
        class="icon-button"
        type="button"
        title="刷新队列"
        aria-label="刷新队列"
        @click="emit('refresh')"
      >
        <RefreshCw :size="17" />
      </button>
    </div>
    <p v-if="!item" class="muted">选择日期声明后查看可执行动作。</p>
    <template v-else>
      <ul v-if="item.blockingReasons.length" class="blockers">
        <li v-for="reason in item.blockingReasons" :key="reason">
          {{ reasonLabels[reason] || reason }}
        </li>
      </ul>
      <p v-else class="ready">录入人与复核人已分离，引用证据均已核验有效。</p>
      <button
        class="approve-button"
        type="button"
        :disabled="!item.allowedActions.includes('approve') || submitting"
        data-testid="approve-date-fact"
        @click="emit('approve')"
      >
        <CheckCircle2 :size="17" />
        {{ submitting ? "正在批准..." : "批准并申请推进" }}
      </button>
    </template>
    <div v-if="result" class="result" data-testid="review-result">
      <strong>{{
        result.applicationState === "applied" ? "已采信并推进" : "日期已确认"
      }}</strong>
      <span v-if="result.applicationState === 'pending_application'"
        >流程条件尚未满足，事实已进入自动重放。</span
      >
      <span v-else-if="result.applicationState === 'review_required'"
        >来源权威仍需处理：{{ result.reasonCode }}</span
      >
      <span v-else>当前应用状态：{{ result.applicationState }}</span>
    </div>
  </section>
</template>

<style scoped>
.action-panel {
  min-width: 0;
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
h2 {
  margin: 0;
  font-size: var(--text-title);
  letter-spacing: 0;
}
.icon-button {
  display: inline-grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line, #d7dde5);
  border-radius: 4px;
  background: #fff;
  color: #344054;
  cursor: pointer;
}
.muted {
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-meta);
}
.blockers {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-5);
  color: #b54708;
  font-size: var(--text-meta);
}
.blockers li + li {
  margin-top: var(--space-2);
}
.ready {
  margin: 0 0 var(--space-4);
  color: #067647;
  font-size: var(--text-meta);
}
.approve-button {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 0;
  border-radius: 5px;
  background: var(--app-brand, #155eef);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.approve-button:disabled {
  background: #d0d5dd;
  cursor: not-allowed;
}
.result {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-3);
  border-left: 3px solid #067647;
  background: #ecfdf3;
  font-size: var(--text-label);
}
</style>
