<script setup lang="ts">
import type { WarehouseDeliveryInstruction } from "@logix/contracts";
import { BadgeCheck, ClipboardCheck } from "@lucide/vue";
import { shallowRef } from "vue";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type {
  DeliveryFactDraft,
  DeliveryFactKind,
} from "../../composables/useWarehouseDeliveryCommands";

const props = defineProps<{
  instruction: WarehouseDeliveryInstruction | null;
  deliveredFact: LifecycleDateFact | null;
  warehouseArrivalFact: LifecycleDateFact | null;
  task: NodeTaskDetail | null;
  submitting: DeliveryFactKind | null;
  results: Partial<Record<DeliveryFactKind, RecordLifecycleDateFactResult>>;
  taskSubmitting: boolean;
  error: string;
}>();
const emit = defineEmits<{
  submit: [draft: DeliveryFactDraft];
  executeTask: [];
}>();
const kind = shallowRef<DeliveryFactKind>("delivered");
const localDateTime = shallowRef("");
const evidence = shallowRef("");
function submit() {
  if (!props.instruction || !localDateTime.value || !evidence.value.trim())
    return;
  const current =
    kind.value === "delivered"
      ? props.deliveredFact
      : props.warehouseArrivalFact;
  emit("submit", {
    kind: kind.value,
    localDateTime: localDateTime.value,
    evidenceInputs: split(evidence.value),
    ...(current ? { supersedesFactId: current.factId } : {}),
  });
}
function split(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
function resultLabel() {
  const result = props.results[kind.value];
  if (!result) return "";
  return result.applicationState === "applied"
    ? "实际送仓已采信并通过门禁"
    : "实际送仓已保存，等待另一名复核人采信";
}
</script>

<template>
  <section class="actions" aria-label="送仓操作区">
    <header>
      <span><BadgeCheck :size="16" />登记实际送仓</span>
    </header>
    <div class="segmented" aria-label="送仓完成依据">
      <button
        type="button"
        :class="{ active: kind === 'delivered' }"
        @click="kind = 'delivered'"
      >
        POD / 签收
      </button>
      <button
        type="button"
        :class="{ active: kind === 'warehouse_arrival' }"
        @click="kind = 'warehouse_arrival'"
      >
        仓库 / WMS 到场
      </button>
    </div>
    <label
      ><span>实际到仓时间（{{ instruction?.timezone ?? "先锁定目的仓" }}）</span
      ><input
        v-model="localDateTime"
        type="datetime-local"
        :disabled="!instruction"
    /></label>
    <label
      ><span>{{
        kind === "delivered"
          ? "POD、门岗或仓库签收证据"
          : "仓库、WMS 或门岗权威证据"
      }}</span
      ><textarea
        v-model="evidence"
        rows="2"
        :disabled="!instruction"
        placeholder="证据 ID 或业务引用，每行一条"
      />
    </label>
    <p v-if="!instruction" class="notice">
      先锁定当前目的仓，系统才能核对实际到仓地点。
    </p>
    <button
      class="primary"
      type="button"
      :disabled="
        !instruction ||
        submitting !== null ||
        !localDateTime ||
        !evidence.trim()
      "
      @click="submit"
    >
      {{ submitting ? "提交中…" : "提交实际送仓复核" }}
    </button>
    <p
      v-if="results[kind]"
      class="result"
      :class="
        results[kind]?.applicationState === 'applied'
          ? 'result--ok'
          : 'result--warn'
      "
    >
      {{ resultLabel() }}
    </p>
    <p v-if="error" class="result result--risk" role="alert">{{ error }}</p>
    <section class="task-action" aria-label="送仓工单操作">
      <header>
        <span><ClipboardCheck :size="16" />岗位工单</span>
      </header>
      <p class="notice">
        工单完成只代表岗位作业完成；只有经采信且目的仓匹配的实际送仓事实才代表货柜到仓。
      </p>
      <button
        v-if="task?.nextAction"
        type="button"
        :disabled="taskSubmitting"
        @click="emit('executeTask')"
      >
        {{
          taskSubmitting
            ? "处理中…"
            : task.nextAction.actionCode === "work_execution.claim_work_order"
              ? "领取送仓任务"
              : "完成送仓工单"
        }}
      </button>
      <p v-else class="notice">
        {{
          task?.state === "completed" ? "送仓工单已完成" : "当前没有可执行动作"
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.actions,
.task-action {
  display: grid;
  gap: var(--space-3);
}
header {
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  font-size: var(--text-label);
  font-weight: 700;
}
header span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
  padding: 0 var(--space-3);
}
label {
  display: grid;
  gap: var(--space-1);
  margin: 0 var(--space-3);
  color: var(--muted);
  font-size: var(--text-micro);
}
input,
textarea,
button {
  min-width: 0;
  min-height: 36px;
  padding: var(--space-2) var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}
textarea {
  resize: vertical;
}
button {
  cursor: pointer;
  font-weight: 700;
}
.segmented .active {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand-strong);
}
.primary,
.task-action > button {
  margin: 0 var(--space-3);
}
.primary {
  background: var(--brand);
  border-color: var(--brand);
  color: var(--on-brand);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.notice,
.result {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-micro);
  overflow-wrap: anywhere;
}
.notice,
.result--warn {
  background: var(--warn-bg);
  color: var(--warn);
}
.result--risk {
  background: var(--risk-bg);
  color: var(--risk);
}
.result--ok {
  background: var(--ok-bg);
  color: var(--ok);
}
</style>
