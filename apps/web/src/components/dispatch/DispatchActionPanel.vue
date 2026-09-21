<script setup lang="ts">
import { ClipboardCheck, Save, Ship } from "@lucide/vue";
import { reactive, ref, watch } from "vue";
import type { ContainerDispatchSnapshot } from "../../api/containerDispatch";
import type { ContainerStuffingSnapshot } from "../../api/containerStuffing";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { DispatchSnapshotDraft } from "../../composables/useDispatchCommands";

const props = defineProps<{
  stuffing: ContainerStuffingSnapshot | null;
  dispatch: ContainerDispatchSnapshot | null;
  gateInFact: LifecycleDateFact | null;
  loadedFact: LifecycleDateFact | null;
  task: NodeTaskDetail | null;
  saving: boolean;
  saveError: string;
  saveMessage: string;
  dateSubmitting: boolean;
  dateError: string;
  dateResult: RecordLifecycleDateFactResult | null;
  taskSubmitting: boolean;
}>();
const emit = defineEmits<{
  save: [draft: DispatchSnapshotDraft];
  submitActual: [eventCode: "gate_in" | "loaded", value: string];
  executeTask: [];
}>();

const form = reactive({
  bookingNumber: "",
  carrierCode: "",
  vesselName: "",
  voyageNumber: "",
  masterBillNumber: "",
  houseBillNumber: "",
  evidence: "",
  reasonCode: "dispatch_confirmed",
});
const gateInAt = ref("");
const loadedAt = ref("");

watch(
  () => props.dispatch,
  (snapshot) => {
    form.bookingNumber = snapshot?.bookingNumber ?? "";
    form.carrierCode = snapshot?.carrierCode ?? "";
    form.vesselName = snapshot?.vesselName ?? "";
    form.voyageNumber = snapshot?.voyageNumber ?? "";
    form.masterBillNumber = snapshot?.masterBillNumber ?? "";
    form.houseBillNumber = snapshot?.houseBillNumber ?? "";
    form.evidence = snapshot?.evidenceRefs.join("\n") ?? "";
    form.reasonCode = snapshot ? "dispatch_corrected" : "dispatch_confirmed";
  },
  { immediate: true },
);

function submitSnapshot() {
  if (!props.stuffing) return;
  emit("save", {
    expectedVersion: props.dispatch?.version ?? 0,
    stuffingSnapshotId: props.stuffing.snapshotId,
    stuffingSnapshotVersion: props.stuffing.version,
    bookingNumber: form.bookingNumber.trim(),
    carrierCode: form.carrierCode.trim(),
    vesselName: form.vesselName.trim(),
    voyageNumber: form.voyageNumber.trim(),
    masterBillNumber: form.masterBillNumber.trim() || null,
    houseBillNumber: form.houseBillNumber.trim() || null,
    vgmHandoffState: "accepted",
    evidenceInputs: form.evidence.split(/[\n,]/),
    reasonCode: form.reasonCode,
  });
}
</script>

<template>
  <section class="actions" aria-label="出运操作区">
    <form aria-label="出运交接表单" @submit.prevent="submitSnapshot">
      <header><span>确认承运交接</span><Save :size="16" /></header>
      <p v-if="!stuffing" class="notice">
        先完成当前装箱记录，再确认出运交接。
      </p>
      <fieldset v-else :disabled="saving">
        <div class="fields">
          <label
            ><span>订舱号</span><input v-model="form.bookingNumber" required
          /></label>
          <label
            ><span>船司代码</span><input v-model="form.carrierCode" required
          /></label>
          <label
            ><span>船名</span><input v-model="form.vesselName" required
          /></label>
          <label
            ><span>航次</span><input v-model="form.voyageNumber" required
          /></label>
          <label
            ><span>主提单号（可后补）</span
            ><input v-model="form.masterBillNumber"
          /></label>
          <label
            ><span>分提单号（可后补）</span
            ><input v-model="form.houseBillNumber"
          /></label>
        </div>
        <label class="wide"
          ><span>订舱 / VGM 接收 / 承运证据，每行一条</span
          ><textarea v-model="form.evidence" rows="3" required />
        </label>
        <label class="confirm"
          ><input type="checkbox" required />VGM 已被船司或码头接收</label
        >
        <button type="submit" class="primary">
          <Save :size="15" />{{
            saving ? "保存中…" : dispatch ? "保存更正版本" : "保存出运交接"
          }}
        </button>
      </fieldset>
      <p v-if="saveError" class="result result--risk" role="alert">
        {{ saveError }}
      </p>
      <p v-else-if="saveMessage" class="result result--ok">{{ saveMessage }}</p>
    </form>

    <section class="date-actions" aria-label="出运实际日期">
      <header><span>登记实际节点</span><Ship :size="16" /></header>
      <p v-if="!dispatch" class="notice">
        先保存出运交接，再登记进港或装船事实。
      </p>
      <template v-else>
        <label
          ><span>重柜实际进港</span
          ><input v-model="gateInAt" type="datetime-local"
        /></label>
        <button
          type="button"
          :disabled="dateSubmitting || !gateInAt"
          @click="emit('submitActual', 'gate_in', gateInAt)"
        >
          登记进港
        </button>
        <small v-if="gateInFact"
          >当前：{{
            new Date(gateInFact.occurredAt).toLocaleString()
          }}（不单独过站）</small
        >
        <label
          ><span>实际装船</span><input v-model="loadedAt" type="datetime-local"
        /></label>
        <button
          class="primary"
          type="button"
          :disabled="dateSubmitting || !loadedAt"
          @click="emit('submitActual', 'loaded', loadedAt)"
        >
          确认实际装船
        </button>
        <small v-if="loadedFact"
          >当前：{{ new Date(loadedFact.occurredAt).toLocaleString() }}</small
        >
      </template>
      <p v-if="dateError" class="result result--risk" role="alert">
        {{ dateError }}
      </p>
      <p
        v-else-if="dateResult"
        class="result"
        :class="
          dateResult.applicationState === 'applied'
            ? 'result--ok'
            : 'result--warn'
        "
      >
        {{
          dateResult.applicationState === "applied"
            ? "事实已采信并推进流程"
            : `事实已保存：${dateResult.reasonCode ?? dateResult.applicationState}`
        }}
      </p>
    </section>

    <section class="task-action" aria-label="出运工单操作">
      <header><span>岗位工单</span><ClipboardCheck :size="16" /></header>
      <p class="notice">完成工单只记录工作结果，不代替实际装船事实。</p>
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
              ? "领取出运任务"
              : "完成出运工单"
        }}
      </button>
      <p v-else class="notice">
        {{
          task?.state === "completed" ? "出运工单已完成" : "当前没有可执行动作"
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.actions,
form,
fieldset,
.date-actions,
.task-action {
  display: grid;
  gap: 10px;
}
form,
.date-actions {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-strong);
}
header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 700;
}
fieldset {
  margin: 0;
  padding: 0 12px;
  border: 0;
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
label {
  min-width: 0;
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 10px;
}
input,
textarea,
button {
  min-width: 0;
  min-height: 36px;
  padding: 7px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}
textarea {
  resize: vertical;
}
.wide,
.date-actions > label,
.date-actions > button,
.date-actions > small,
.task-action > button {
  margin: 0 12px;
}
.confirm {
  display: flex;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 7px;
  color: var(--ink);
}
.confirm input {
  width: 16px;
  min-height: 16px;
}
button {
  cursor: pointer;
  font-weight: 700;
}
.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
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
small {
  color: var(--muted);
  font-size: 10px;
}
@media (max-width: 560px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
