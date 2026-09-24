<script setup lang="ts">
import { ClipboardCheck, FileCheck2, Save } from "@lucide/vue";
import { computed, reactive, shallowRef, watch } from "vue";
import type { CustomsClearanceCaseView } from "../../api/customsClearance";
import type { RecordLifecycleDateFactResult } from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { CustomsCaseDraft } from "../../composables/useCustomsCommands";

const props = defineProps<{
  clearanceCase: CustomsClearanceCaseView | null;
  task: NodeTaskDetail | null;
  projectionVersion: number;
  saving: boolean;
  saveError: string;
  saveMessage: string;
  dateSubmitting: boolean;
  dateError: string;
  dateResult: RecordLifecycleDateFactResult | null;
  taskSubmitting: boolean;
}>();
const emit = defineEmits<{
  save: [draft: CustomsCaseDraft];
  submitActual: [value: string];
  executeTask: [];
}>();

const form = reactive({
  jurisdictionCountryCode: "",
  customsBrokerPartyId: "",
  declarationNumber: "",
  filingState: "not_filed" as CustomsClearanceCaseView["filingState"],
  decisionState: "pending" as CustomsClearanceCaseView["decisionState"],
  activeHoldCodes: "",
  evidence: "",
  reasonCode: "CUSTOMS_CASE_CREATED",
});
const actualAt = shallowRef("");
const canSave = computed(() => {
  if (!/^[A-Za-z]{2}$/.test(form.jurisdictionCountryCode.trim())) return false;
  if (form.filingState !== "not_filed") {
    if (!form.customsBrokerPartyId.trim() || !form.declarationNumber.trim())
      return false;
  }
  if (form.decisionState === "held" && !form.activeHoldCodes.trim())
    return false;
  if (form.decisionState === "released") {
    return form.filingState === "accepted" && Boolean(form.evidence.trim());
  }
  return true;
});

watch(
  () => props.clearanceCase,
  (value) => {
    form.jurisdictionCountryCode = value?.jurisdictionCountryCode ?? "";
    form.customsBrokerPartyId = value?.customsBrokerPartyId ?? "";
    form.declarationNumber = value?.declarationNumber ?? "";
    form.filingState = value?.filingState ?? "not_filed";
    form.decisionState = value?.decisionState ?? "pending";
    form.activeHoldCodes = value?.activeHoldCodes.join("\n") ?? "";
    form.evidence = value?.evidenceRefs.join("\n") ?? "";
    form.reasonCode = value ? "CUSTOMS_CASE_CORRECTED" : "CUSTOMS_CASE_CREATED";
  },
  { immediate: true },
);

function submitCase() {
  if (!canSave.value) return;
  emit("save", {
    expectedVersion: props.clearanceCase?.version ?? 0,
    jurisdictionCountryCode: form.jurisdictionCountryCode.trim().toUpperCase(),
    customsBrokerPartyId: form.customsBrokerPartyId.trim() || null,
    declarationNumber: form.declarationNumber.trim() || null,
    filingState: form.filingState,
    decisionState: form.decisionState,
    activeHoldCodes: split(form.activeHoldCodes).map((value) =>
      value.toUpperCase(),
    ),
    evidenceInputs: split(form.evidence),
    reasonCode: form.reasonCode,
  });
}

function split(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
</script>

<template>
  <section class="actions" aria-label="清关操作区">
    <form aria-label="清关案件表单" @submit.prevent="submitCase">
      <header><span>维护清关案件</span><Save :size="16" /></header>
      <fieldset :disabled="saving">
        <div class="fields">
          <label
            ><span>进口国/地区代码</span
            ><input
              v-model="form.jurisdictionCountryCode"
              maxlength="2"
              required
          /></label>
          <label
            ><span>清关行档案 ID</span
            ><input
              v-model="form.customsBrokerPartyId"
              :required="form.filingState !== 'not_filed'"
          /></label>
          <label
            ><span>申报编号</span
            ><input
              v-model="form.declarationNumber"
              :required="form.filingState !== 'not_filed'"
          /></label>
          <label
            ><span>申报状态</span
            ><select v-model="form.filingState">
              <option value="not_filed">未申报</option>
              <option value="filed">已申报</option>
              <option value="accepted">申报已受理</option>
            </select></label
          >
          <label
            ><span>海关决定</span
            ><select v-model="form.decisionState">
              <option value="pending">待决定</option>
              <option value="held">扣留</option>
              <option value="released">放行</option>
            </select></label
          >
          <label
            ><span>变更原因</span><input v-model="form.reasonCode" required
          /></label>
        </div>
        <label
          ><span>活动扣留代码，每行一项</span
          ><textarea
            v-model="form.activeHoldCodes"
            rows="2"
            :required="form.decisionState === 'held'"
          />
        </label>
        <label
          ><span>申报受理 / 海关决定证据，每行一条</span
          ><textarea
            v-model="form.evidence"
            rows="3"
            :required="form.decisionState === 'released'"
          />
        </label>
        <button class="primary" type="submit" :disabled="!canSave">
          <Save :size="15" />{{
            saving ? "保存中…" : clearanceCase ? "保存更正版本" : "建立清关案件"
          }}
        </button>
      </fieldset>
      <p v-if="saveError" class="result result--risk" role="alert">
        {{ saveError }}
      </p>
      <p v-else-if="saveMessage" class="result result--ok">{{ saveMessage }}</p>
    </form>

    <section class="date-action" aria-label="实际清关日期">
      <header><span>登记实际清关</span><FileCheck2 :size="16" /></header>
      <p v-if="clearanceCase?.decisionState !== 'released'" class="notice">
        海关放行并清除活动扣留后，才能提交实际清关时间。
      </p>
      <template v-else>
        <label
          ><span>实际清关时间</span
          ><input v-model="actualAt" type="datetime-local"
        /></label>
        <button
          class="primary"
          type="button"
          :disabled="dateSubmitting || !actualAt"
          @click="emit('submitActual', actualAt)"
        >
          提交复核
        </button>
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
            ? "日期已采信并推进清关节点"
            : "日期已保存，等待复核与门禁满足"
        }}
      </p>
    </section>

    <section class="task-action" aria-label="清关工单操作">
      <header><span>岗位工单</span><ClipboardCheck :size="16" /></header>
      <p class="notice">
        完成工单只记录清关岗位工作，不等于海关放行或流程过站。
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
              ? "领取清关任务"
              : "完成清关工单"
        }}
      </button>
      <p v-else class="notice">
        {{
          task?.state === "completed" ? "清关工单已完成" : "当前没有可执行动作"
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.actions,
form,
fieldset,
.date-action,
.task-action {
  display: grid;
  gap: var(--space-3);
}
form,
.date-action {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--line-strong);
}
header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  font-size: var(--text-label);
  font-weight: 700;
}
fieldset {
  margin: 0;
  padding: 0 var(--space-3);
  border: 0;
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
label {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
}
input,
select,
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
.date-action > label,
.date-action > button,
.task-action > button {
  margin: 0 var(--space-3);
}
button {
  cursor: pointer;
  font-weight: 700;
}
.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
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
@media (max-width: 560px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
