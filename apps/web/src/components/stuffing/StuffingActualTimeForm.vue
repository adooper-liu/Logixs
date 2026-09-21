<script setup lang="ts">
import { ClockCheck } from "@lucide/vue";
import { computed, ref } from "vue";
import type { ContainerStuffingSnapshot } from "../../api/containerStuffing";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../../api/lifecycleDateFacts";

const props = defineProps<{
  snapshot: ContainerStuffingSnapshot | null;
  actualFact: LifecycleDateFact | null;
  result: RecordLifecycleDateFactResult | null;
  submitting: boolean;
  error: string;
}>();

const emit = defineEmits<{ submit: [localDateTime: string] }>();
const localDateTime = ref("");
const outcome = computed(() => {
  const state =
    props.result?.applicationState ?? props.actualFact?.applicationState;
  if (!state) return null;
  if (state === "applied")
    return { label: "已应用，装箱节点已过站", tone: "ok" };
  if (state === "rejected")
    return { label: "被拒绝，请按原因更正", tone: "risk" };
  if (state === "review_required")
    return { label: "已保存，等待来源与证据复核", tone: "warn" };
  if (state === "pending_application")
    return { label: "已保存，等待前序或装箱条件满足后自动重放", tone: "warn" };
  return { label: "日期已保存，本次不用于过站", tone: "info" };
});
const reasonCode = computed(
  () => props.result?.reasonCode ?? props.actualFact?.applicationReasonCode,
);
</script>

<template>
  <form
    class="actual-form"
    aria-label="实际装箱时间表单"
    @submit.prevent="emit('submit', localDateTime)"
  >
    <header><span>实际装箱时间</span><ClockCheck :size="16" /></header>
    <p v-if="!snapshot" class="form-notice">
      先保存当前装载版本对应的装箱记录，再提交实际时间。
    </p>
    <template v-else>
      <label
        ><span>实际完成时间</span
        ><input
          v-model="localDateTime"
          type="datetime-local"
          required
          :disabled="submitting"
      /></label>
      <button
        type="submit"
        class="primary-action"
        :disabled="submitting || !localDateTime"
      >
        {{ submitting ? "正在提交…" : "提交实际装箱时间" }}
      </button>
    </template>
    <p v-if="error" class="result result--risk" role="alert">{{ error }}</p>
    <section
      v-else-if="outcome"
      class="application-result"
      :class="`application-result--${outcome.tone}`"
      aria-label="日期应用结果"
    >
      <b>{{ outcome.label }}</b>
      <span v-if="reasonCode">原因：{{ reasonCode }}</span>
      <time v-if="actualFact"
        >当前记录：{{ new Date(actualFact.occurredAt).toLocaleString() }}</time
      >
    </section>
  </form>
</template>

<style scoped>
.actual-form {
  display: grid;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-strong);
}
.actual-form > header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 700;
}
.actual-form > label {
  display: grid;
  gap: 4px;
  padding: 0 12px;
  color: var(--muted);
  font-size: 10px;
}
input {
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}
.primary-action {
  min-height: 38px;
  margin: 0 12px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 700;
  cursor: pointer;
}
.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.form-notice,
.result,
.application-result {
  margin: 0;
  padding: 9px 12px;
  font-size: 11px;
}
.form-notice,
.application-result--warn {
  background: var(--warn-bg);
  color: var(--warn);
}
.result--risk,
.application-result--risk {
  background: var(--risk-bg);
  color: var(--risk);
}
.application-result--ok {
  background: var(--ok-bg);
  color: var(--ok);
}
.application-result--info {
  background: var(--info-bg);
  color: var(--ink-soft);
}
.application-result {
  display: grid;
  gap: 3px;
}
.application-result span,
.application-result time {
  font-size: 10px;
}
</style>
