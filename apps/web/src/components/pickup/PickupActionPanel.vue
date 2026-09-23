<script setup lang="ts">
import { ClipboardCheck, Clock3, LogOut, MapPin } from "@lucide/vue";
import { computed, reactive, shallowRef, watch } from "vue";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type {
  PickupFactDraft,
  PickupFactKind,
} from "../../composables/usePickupCommands";

const props = defineProps<{
  availableFact: LifecycleDateFact | null;
  gateOutFact: LifecycleDateFact | null;
  task: NodeTaskDetail | null;
  submitting: PickupFactKind | null;
  error: string;
  results: Partial<Record<PickupFactKind, RecordLifecycleDateFactResult>>;
  taskSubmitting: boolean;
}>();
const emit = defineEmits<{
  submit: [draft: PickupFactDraft];
  executeTask: [];
}>();

const location = reactive({
  locationType: "terminal" as "terminal" | "port",
  unlocode: "",
  locationId: "",
  portCallId: "",
  timezone: "",
});
const availableAt = shallowRef("");
const gateOutAt = shallowRef("");
const availableEvidence = shallowRef("");
const gateOutEvidence = shallowRef("");
const locationValid = computed(
  () =>
    /^[A-Za-z]{2}[A-Za-z0-9]{3}$/.test(location.unlocode.trim()) &&
    Boolean(location.timezone.trim()) &&
    (!location.locationId.trim() || uuid(location.locationId.trim())),
);

watch(
  () => props.gateOutFact?.location ?? props.availableFact?.location,
  (value) => {
    if (!value) return;
    if (value.locationType === "terminal" || value.locationType === "port")
      location.locationType = value.locationType;
    location.unlocode = value.unlocode ?? "";
    location.locationId = value.locationId ?? "";
    location.portCallId = value.portCallId ?? "";
    location.timezone = value.timezone;
  },
  { immediate: true },
);

function submit(kind: PickupFactKind) {
  const localDateTime =
    kind === "available" ? availableAt.value : gateOutAt.value;
  const evidence =
    kind === "available" ? availableEvidence.value : gateOutEvidence.value;
  if (!locationValid.value || !localDateTime || !evidence.trim()) return;
  const current =
    kind === "available" ? props.availableFact : props.gateOutFact;
  emit("submit", {
    kind,
    localDateTime,
    evidenceInputs: split(evidence),
    location: {
      locationType: location.locationType,
      unlocode: location.unlocode.trim().toUpperCase(),
      ...(location.locationId.trim()
        ? { locationId: location.locationId.trim() }
        : {}),
      ...(location.portCallId.trim()
        ? { portCallId: location.portCallId.trim() }
        : {}),
      timezone: location.timezone.trim(),
    },
    ...(current ? { supersedesFactId: current.factId } : {}),
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

function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function resultLabel(kind: PickupFactKind): string {
  const result = props.results[kind];
  if (!result) return "";
  if (result.applicationState === "applied")
    return kind === "available"
      ? "可提事实已采信，待应用的 Gate Out 已自动重放"
      : "Gate Out 已采信并通过提柜门禁";
  return "事实已保存，等待复核或门禁条件满足";
}
</script>

<template>
  <section class="actions" aria-label="提柜操作区">
    <section class="location-form" aria-label="提柜地点">
      <header><span>目的码头</span><MapPin :size="16" /></header>
      <div class="fields">
        <label
          ><span>地点层级</span
          ><select v-model="location.locationType">
            <option value="terminal">码头</option>
            <option value="port">港口</option>
          </select></label
        >
        <label
          ><span>UN/LOCODE</span
          ><input v-model="location.unlocode" maxlength="5" placeholder="USLAX"
        /></label>
        <label
          ><span>码头档案 ID（可选）</span><input v-model="location.locationId"
        /></label>
        <label
          ><span>IANA 时区</span
          ><input v-model="location.timezone" placeholder="America/Los_Angeles"
        /></label>
        <label class="wide"
          ><span>Port Call ID（可选）</span
          ><input v-model="location.portCallId"
        /></label>
      </div>
      <p v-if="!locationValid" class="result result--warn">
        请填写有效 UN/LOCODE、IANA 时区；码头档案 ID 必须是 UUID。
      </p>
    </section>

    <section class="fact-action" aria-label="码头可提事实">
      <header><span>登记码头可提</span><Clock3 :size="16" /></header>
      <label
        ><span>可提实际时间</span
        ><input v-model="availableAt" type="datetime-local"
      /></label>
      <label
        ><span>码头可提证据</span
        ><textarea
          v-model="availableEvidence"
          rows="2"
          placeholder="证据 ID 或文件引用，每行一条"
        />
      </label>
      <button
        class="primary"
        type="button"
        :disabled="
          submitting !== null ||
          !locationValid ||
          !availableAt ||
          !availableEvidence.trim()
        "
        @click="submit('available')"
      >
        {{
          submitting === "available"
            ? "提交中…"
            : availableFact
              ? "提交可提更正"
              : "提交可提复核"
        }}
      </button>
      <p
        v-if="results.available"
        class="result"
        :class="
          results.available.applicationState === 'applied'
            ? 'result--ok'
            : 'result--warn'
        "
      >
        {{ resultLabel("available") }}
      </p>
    </section>

    <section class="fact-action" aria-label="重柜出场事实">
      <header><span>登记重柜 Gate Out</span><LogOut :size="16" /></header>
      <label
        ><span>实际出场时间</span
        ><input v-model="gateOutAt" type="datetime-local"
      /></label>
      <label
        ><span>EIR / 出场证据</span
        ><textarea
          v-model="gateOutEvidence"
          rows="2"
          placeholder="证据 ID 或文件引用，每行一条"
        />
      </label>
      <button
        class="primary"
        type="button"
        :disabled="
          submitting !== null ||
          !locationValid ||
          !gateOutAt ||
          !gateOutEvidence.trim()
        "
        @click="submit('gate_out')"
      >
        {{
          submitting === "gate_out"
            ? "提交中…"
            : gateOutFact
              ? "提交 Gate Out 更正"
              : "提交 Gate Out 复核"
        }}
      </button>
      <p
        v-if="results.gate_out"
        class="result"
        :class="
          results.gate_out.applicationState === 'applied'
            ? 'result--ok'
            : 'result--warn'
        "
      >
        {{ resultLabel("gate_out") }}
      </p>
    </section>

    <p v-if="error" class="result result--risk" role="alert">{{ error }}</p>

    <section class="task-action" aria-label="提柜工单操作">
      <header><span>岗位工单</span><ClipboardCheck :size="16" /></header>
      <p class="notice">
        工单完成只代表岗位作业完成；只有经采信的 Gate Out 才代表货柜已提走。
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
              ? "领取提柜任务"
              : "完成提柜工单"
        }}
      </button>
      <p v-else class="notice">
        {{
          task?.state === "completed" ? "提柜工单已完成" : "当前没有可执行动作"
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.actions,
.location-form,
.fact-action,
.task-action {
  display: grid;
  gap: var(--space-3);
}
.location-form,
.fact-action {
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
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 var(--space-3);
}
.wide {
  grid-column: 1 / -1;
}
label {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  margin: 0 var(--space-3);
  color: var(--muted);
  font-size: var(--text-micro);
}
.fields label {
  margin: 0;
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
.fact-action > button,
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
@media (max-width: 560px) {
  .fields {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
