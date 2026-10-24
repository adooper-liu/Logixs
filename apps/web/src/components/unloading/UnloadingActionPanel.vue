<script setup lang="ts">
import type {
  ContainerUnloadingReport,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { ClipboardCheck, Save } from "@lucide/vue";
import { computed, reactive, shallowRef, watch } from "vue";
import SubmissionProgress from "../task/SubmissionProgress.vue";
import type { SubmissionView } from "../../data/sample";
import type { RecordLifecycleDateFactResult } from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { UnloadingReportDraft } from "../../composables/useContainerUnloadingCommands";

const props = defineProps<{
  instruction: WarehouseDeliveryInstruction | null;
  draftIdentity?: string;
  disabled?: boolean;
  submission?: SubmissionView | null;
  report: ContainerUnloadingReport | null;
  task: NodeTaskDetail | null;
  submitting: boolean;
  taskSubmitting: boolean;
  factResult: RecordLifecycleDateFactResult | null;
  error: string;
  attemptStage?: "report" | "date" | "reload" | null;
}>();
const emit = defineEmits<{
  submit: [draft: UnloadingReportDraft];
  executeTask: [];
  retryTask: [];
  dirtyChange: [dirty: boolean];
  retryAttempt: [];
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
const reconciledReportId = shallowRef<string | null>(null);
const semanticConflict = shallowRef(false);
const baseline = shallowRef("");
const dirty = computed(
  () =>
    JSON.stringify({
      ...form,
      evidenceInputs: undefined,
      evidenceText: evidenceText.value,
    }) !== baseline.value,
);
const authorityConflict = computed(() =>
  Boolean(
    props.report &&
    props.instruction &&
    props.report.warehouseLocationId !==
      props.instruction.warehouseLocationId &&
    reconciledReportId.value !== props.report.reportId,
  ),
);
const draftConflict = computed(() => {
  const basis = formBasis.value;
  const current = props.instruction;
  return Boolean(
    dirty.value &&
    basis &&
    current &&
    (basis.locationId !== current.warehouseLocationId ||
      basis.timezone !== current.timezone),
  );
});
const needsReconciliation = computed(
  () =>
    draftConflict.value || authorityConflict.value || semanticConflict.value,
);
const formBasis = shallowRef<{
  instructionId: string;
  version: number;
  locationId: string;
  timezone: string;
} | null>(null);
baseline.value = JSON.stringify({
  ...form,
  evidenceInputs: undefined,
  evidenceText: evidenceText.value,
});

watch(
  () => props.report,
  (report) => {
    if (report?.reportId !== reconciledReportId.value)
      reconciledReportId.value = null;
    semanticConflict.value = false;
    if (!report || dirty.value) return;
    form.operationState = report.operationState;
    form.startedLocal = localInput(
      report.startedAt,
      props.instruction?.timezone,
    );
    form.completedLocal = localInput(
      report.completedAt,
      props.instruction?.timezone,
    );
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
    baseline.value = snapshot();
    bindBasis();
  },
  { immediate: true },
);

watch(
  () => props.draftIdentity,
  () => {
    resetForm();
  },
);
watch(
  dirty,
  (value) => {
    if (value) bindBasis();
    emit("dirtyChange", value);
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => [
    props.instruction?.instructionId,
    props.instruction?.version,
    props.instruction?.warehouseLocationId,
    props.instruction?.timezone,
  ],
  () => {
    const current = props.instruction;
    const basis = formBasis.value;
    if (!current) return;
    if (
      !dirty.value &&
      !semanticConflict.value &&
      props.report &&
      basis &&
      basis.locationId === current.warehouseLocationId &&
      basis.timezone !== current.timezone
    ) {
      // A clean report's local clock is already a user-facing fact. Preserve
      // it until the operator explicitly starts a new authority-bound draft.
      semanticConflict.value = true;
      return;
    }
    if (semanticConflict.value) return;
    if (!dirty.value) {
      bindBasis();
      if (
        props.report &&
        props.report.warehouseLocationId === current.warehouseLocationId
      ) {
        form.startedLocal = localInput(
          props.report.startedAt,
          current.timezone,
        );
        form.completedLocal = localInput(
          props.report.completedAt,
          current.timezone,
        );
        baseline.value = snapshot();
      }
    }
  },
);
function snapshot() {
  return JSON.stringify({
    ...form,
    evidenceInputs: undefined,
    evidenceText: evidenceText.value,
  });
}
function bindBasis() {
  if (props.instruction)
    formBasis.value = {
      instructionId: props.instruction.instructionId,
      version: props.instruction.version,
      locationId: props.instruction.warehouseLocationId,
      timezone: props.instruction.timezone,
    };
}
function reconcile() {
  resetForm();
  semanticConflict.value = false;
  bindBasis();
  reconciledReportId.value = props.report?.reportId ?? null;
}
function resetForm() {
  Object.assign(form, {
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
  evidenceText.value = "";
  baseline.value = snapshot();
  formBasis.value = null;
  semanticConflict.value = false;
}

function submit() {
  if (props.disabled || needsReconciliation.value) return;
  form.evidenceInputs = split(evidenceText.value);
  emit("submit", { ...form, evidenceInputs: [...form.evidenceInputs] });
}
function retryTask() {
  if (
    !props.disabled &&
    !props.taskSubmitting &&
    !props.submitting &&
    props.submission?.canRetry
  )
    emit("retryTask");
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
function localInput(value: string | null | undefined, timezone?: string) {
  if (!value) return "";
  if (timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(value));
    const pick = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
  }
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
    <p v-if="needsReconciliation" class="notice notice--error" role="alert">
      {{
        authorityConflict
          ? "当前报告属于旧目的仓，请重新核对后再提交"
          : semanticConflict
            ? "指令时区已变化，原本地时间不能静默重解释；请重新核对并开始新草稿"
            : "目的仓或时区已变更，请重新核对后再提交"
      }}
    </p>
    <button
      v-if="needsReconciliation"
      type="button"
      class="secondary"
      @click="reconcile()"
    >
      重新核对并开始新草稿
    </button>
    <button
      class="primary"
      type="button"
      :disabled="
        !instruction ||
        disabled ||
        needsReconciliation ||
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
    <section
      v-if="attemptStage"
      class="result result--warn"
      aria-label="未完成卸柜尝试"
    >
      <strong
        >存在未完成的{{
          attemptStage === "date"
            ? "完成日期"
            : attemptStage === "reload"
              ? "刷新"
              : "报告"
        }}尝试</strong
      >
      <span>已保存阶段会按原版本和原幂等键恢复，编辑中的新值尚未保存。</span>
      <button
        type="button"
        class="secondary"
        :disabled="submitting || disabled"
        @click="emit('retryAttempt')"
      >
        恢复原尝试
      </button>
    </section>
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
        :disabled="disabled || taskSubmitting || submitting"
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
      <SubmissionProgress
        v-if="submission"
        :submission="submission"
        @retry="retryTask"
      />
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
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1);
  padding: 0 var(--space-3);
}
.segmented--two {
  grid-template-columns: repeat(2, 1fr);
}
.quantity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 var(--space-3);
}
label {
  display: grid;
  gap: var(--space-1);
  margin: 0 var(--space-3);
  color: var(--muted);
  font-size: var(--text-micro);
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
  padding: var(--space-2) var(--space-2);
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
.task-action > button,
.secondary {
  margin: 0 var(--space-3);
}
.primary {
  background: var(--brand);
  border-color: var(--brand);
  color: var(--on-brand);
}
.secondary {
  background: var(--surface);
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
@media (max-width: 520px) {
  .quantity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
