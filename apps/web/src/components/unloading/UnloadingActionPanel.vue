<script setup lang="ts">
import type {
  ContainerUnloadingReport,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { ClipboardCheck, Save } from "@lucide/vue";
import { reactive, shallowRef, watch } from "vue";
import type { RecordLifecycleDateFactResult } from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { UnloadingReportDraft } from "../../composables/useContainerUnloadingCommands";

const props = defineProps<{
  instruction: WarehouseDeliveryInstruction | null;
  report: ContainerUnloadingReport | null;
  task: NodeTaskDetail | null;
  submitting: boolean;
  taskSubmitting: boolean;
  factResult: RecordLifecycleDateFactResult | null;
  error: string;
}>();
const emit = defineEmits<{
  submit: [draft: UnloadingReportDraft];
  executeTask: [];
}>();
const form = reactive<UnloadingReportDraft>({
  operationState: "started",
  startedLocal: "",
  completedLocal: "",
  expectedQuantity: "",
  unloadedQuantity: "0",
  remainingQuantity: "",
  damagedQuantity: "0",
  shortageQuantity: "0",
  quantityUnit: "carton",
  sealCheck: "matched",
  exceptionResolved: false,
  exceptionNotes: "",
  evidenceInputs: [],
});
const evidenceText = shallowRef("");

watch(
  () => props.report,
  (report) => {
    if (!report) return;
    form.operationState =
      report.operationState === "completed" ? "completed" : "partial";
    form.startedLocal = localInput(report.startedAt);
    form.completedLocal = localInput(report.completedAt);
    form.expectedQuantity = report.expectedQuantity;
    form.unloadedQuantity = report.unloadedQuantity;
    form.remainingQuantity = report.remainingQuantity;
    form.damagedQuantity = report.damagedQuantity;
    form.shortageQuantity = report.shortageQuantity;
    form.quantityUnit = report.quantityUnit;
    form.sealCheck = report.sealCheck;
    form.exceptionResolved = report.exceptionResolved;
    form.exceptionNotes = report.exceptionNotes ?? "";
    evidenceText.value = report.evidenceRefs.join("\n");
  },
  { immediate: true },
);

function submit() {
  form.evidenceInputs = split(evidenceText.value);
  emit("submit", { ...form, evidenceInputs: [...form.evidenceInputs] });
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
function localInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function resultLabel() {
  if (!props.factResult) return "卸货进度已保存";
  return props.factResult.applicationState === "applied"
    ? "卸柜完成已采信并通过门禁"
    : "卸柜完成已保存，等待另一名复核人采信";
}
</script>

<template>
  <section class="actions" aria-label="卸柜操作区">
    <header>
      <span><Save :size="16" />登记卸货作业</span>
    </header>
    <div class="segmented" aria-label="卸货作业状态">
      <button
        v-for="state in ['started', 'partial', 'completed'] as const"
        :key="state"
        type="button"
        :class="{ active: form.operationState === state }"
        @click="form.operationState = state"
      >
        {{
          state === "started"
            ? "开始卸货"
            : state === "partial"
              ? "部分卸货"
              : "卸柜完成"
        }}
      </button>
    </div>
    <label
      ><span>卸货开始时间（{{ instruction?.timezone ?? "先锁定目的仓" }}）</span
      ><input
        v-model="form.startedLocal"
        type="datetime-local"
        :disabled="!instruction"
    /></label>
    <label v-if="form.operationState === 'completed'"
      ><span>实际卸完时间</span
      ><input v-model="form.completedLocal" type="datetime-local"
    /></label>
    <div class="quantity-grid">
      <label
        ><span>计划数量</span
        ><input v-model="form.expectedQuantity" inputmode="decimal"
      /></label>
      <label
        ><span>已卸数量</span
        ><input v-model="form.unloadedQuantity" inputmode="decimal"
      /></label>
      <label
        ><span>剩余数量</span
        ><input v-model="form.remainingQuantity" inputmode="decimal"
      /></label>
      <label
        ><span>数量单位</span
        ><select v-model="form.quantityUnit">
          <option value="carton">箱</option>
          <option value="piece">件</option>
          <option value="set">套</option>
          <option value="pallet">托</option>
        </select></label
      >
      <label
        ><span>破损数量</span
        ><input v-model="form.damagedQuantity" inputmode="decimal"
      /></label>
      <label
        ><span>短少数量</span
        ><input v-model="form.shortageQuantity" inputmode="decimal"
      /></label>
    </div>
    <div class="segmented segmented--two" aria-label="封号核对结果">
      <button
        type="button"
        :class="{ active: form.sealCheck === 'matched' }"
        @click="form.sealCheck = 'matched'"
      >
        封号一致
      </button>
      <button
        type="button"
        :class="{ active: form.sealCheck === 'mismatch' }"
        @click="form.sealCheck = 'mismatch'"
      >
        封号不一致
      </button>
    </div>
    <label class="check"
      ><input
        v-model="form.exceptionResolved"
        type="checkbox"
      />破损、短少或封号异常已完成处理</label
    >
    <label
      ><span>异常与处理说明</span
      ><textarea
        v-model="form.exceptionNotes"
        rows="2"
        placeholder="存在异常时必填"
      />
    </label>
    <label
      ><span>卸货清单、照片或仓方确认</span
      ><textarea
        v-model="evidenceText"
        rows="2"
        placeholder="证据 ID 或业务引用，每行一条"
      />
    </label>
    <p v-if="!instruction" class="notice">
      先在送仓工作台锁定目的仓，系统才能核对卸货地点。
    </p>
    <button
      class="primary"
      type="button"
      :disabled="
        !instruction ||
        submitting ||
        !form.startedLocal ||
        !form.expectedQuantity ||
        !form.remainingQuantity ||
        !evidenceText.trim() ||
        (form.operationState === 'completed' && !form.completedLocal)
      "
      @click="submit"
    >
      {{
        submitting
          ? "提交中…"
          : form.operationState === "completed"
            ? "保存完成并提交复核"
            : "保存卸货进度"
      }}
    </button>
    <p
      v-if="factResult || report"
      class="result"
      :class="
        factResult?.applicationState === 'applied'
          ? 'result--ok'
          : 'result--warn'
      "
    >
      {{ resultLabel() }}
    </p>
    <p v-if="error" class="result result--risk" role="alert">{{ error }}</p>
    <section class="task-action" aria-label="卸柜工单操作">
      <header>
        <span><ClipboardCheck :size="16" />岗位工单</span>
      </header>
      <p class="notice">
        工单完成只记录岗位作业；部分卸货不等于卸柜完成，卸柜完成也不等于下一站卸空确认。
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
              ? "领取卸柜任务"
              : "完成卸柜工单"
        }}
      </button>
      <p v-else class="notice">
        {{
          task?.state === "completed" ? "卸柜工单已完成" : "当前没有可执行动作"
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.actions,
.task-action {
  display: grid;
  gap: 10px;
}
header {
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 700;
}
header span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 0 12px;
}
.segmented--two {
  grid-template-columns: repeat(2, 1fr);
}
.quantity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0 12px;
}
label {
  display: grid;
  gap: 4px;
  margin: 0 12px;
  color: var(--muted);
  font-size: 10px;
}
.quantity-grid label {
  margin: 0;
}
.check {
  grid-template-columns: 18px 1fr;
  align-items: center;
  color: var(--ink-soft);
}
input,
textarea,
select,
button {
  min-width: 0;
  min-height: 36px;
  padding: 7px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}
.check input {
  min-height: 18px;
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
  margin: 0 12px;
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
  padding: 9px 12px;
  font-size: 11px;
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
@media (max-width: 520px) {
  .quantity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
