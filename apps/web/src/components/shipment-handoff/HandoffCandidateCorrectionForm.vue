<script setup lang="ts">
import { Check, PencilLine, Search, Save, X } from "@lucide/vue";
import {
  computed,
  nextTick,
  reactive,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import type {
  PostDepartureShipmentGroupingV1,
  ShipmentSummaryV1,
} from "@logix/contracts";
import type {
  PostDepartureReferencePortV1,
  PostDepartureSourceCandidateV1,
} from "../../api/postDepartureSourcePackages";
import {
  handoffIssueAction,
  type HandoffIssueInput,
  type HandoffResolutionTarget,
} from "../../data/postDepartureHandoffCopy";
import type { CandidateCorrectionDraft } from "../../composables/usePostDepartureHandoffWorkbench";
import { sourceDepartureRawToLocalInput } from "../../data/postDepartureTime";
import HandoffShipmentGroupingSelector from "./HandoffShipmentGroupingSelector.vue";

const props = defineProps<{
  candidate: PostDepartureSourceCandidateV1;
  shipmentOptions: readonly ShipmentSummaryV1[];
  loadingShipmentOptions: boolean;
  shipmentOptionsError: string;
  originOptions: readonly PostDepartureReferencePortV1[];
  destinationOptions: readonly PostDepartureReferencePortV1[];
  searchingOrigin: boolean;
  searchingDestination: boolean;
  saving: boolean;
  error: string;
  focusTarget: HandoffResolutionTarget;
  result: {
    remainingIssues: readonly HandoffIssueInput[];
  } | null;
}>();

const emit = defineEmits<{
  searchPort: [scope: "origin" | "destination", query: string];
  submit: [draft: CandidateCorrectionDraft];
  cancel: [];
}>();

type CandidateCorrectionFormDraft = CandidateCorrectionDraft;

const draft = reactive<CandidateCorrectionFormDraft>(emptyDraft());
const originQuery = shallowRef("");
const destinationQuery = shallowRef("");
const localError = shallowRef("");
const shipmentSection = useTemplateRef<HTMLElement>("shipmentSection");
const originInput = useTemplateRef<HTMLInputElement>("originInput");
const destinationInput = useTemplateRef<HTMLInputElement>("destinationInput");
const departureInput = useTemplateRef<HTMLInputElement>("departureInput");

const focusTitle = computed(
  () =>
    ({
      shipment_grouping: "确认所属出运",
      origin_port: "确认起运港",
      destination_port: "确认目的港",
      departure: "补离港依据",
      cargo: "先完成基础出运信息",
      cargo_owner: "补齐接管信息",
      sources: "补齐接管信息",
    })[props.focusTarget],
);

const systemHandledCount = computed(
  () =>
    props.candidate.issues.filter(
      (issue) => issue.resolutionState === "system_handled",
    ).length,
);
const editStatusLabel = computed(() =>
  props.saving ? "正在保存" : props.result ? "已保存" : "可随时保存",
);

watch(
  () => [props.candidate.candidateRef, props.candidate.correction?.version],
  () => resetFromCandidate(),
  { immediate: true },
);

watch(
  () => props.focusTarget,
  () => focusRequestedField(),
  { immediate: true },
);

async function focusRequestedField(): Promise<void> {
  await nextTick();
  const target =
    props.focusTarget === "origin_port"
      ? originInput.value
      : props.focusTarget === "destination_port"
        ? destinationInput.value
        : props.focusTarget === "departure"
          ? departureInput.value
          : shipmentSection.value?.querySelector<HTMLButtonElement>("button");
  target?.focus();
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function resetFromCandidate(): void {
  const correction = props.candidate.correction;
  Object.assign(draft, {
    shipmentGrouping: editableGrouping(correction?.shipmentGrouping),
    originPortCode: correction?.originPort?.unlocode ?? "",
    destinationPortCode: correction?.destinationPort?.unlocode ?? "",
    departureLocal:
      correction?.departureLocal ??
      (correction?.departureProof
        ? toLocalInput(
            correction.departureProof.occurredAt,
            correction.departureProof.sourceTimezone,
          )
        : sourceDepartureRawToLocalInput(props.candidate.departureRaw)),
    sourceTimezone:
      correction?.departureSourceTimezone ??
      correction?.departureProof?.sourceTimezone ??
      "",
    evidenceRef: "",
  });
  originQuery.value = correction?.originPort
    ? `${correction.originPort.unlocode} · ${correction.originPort.officialName}`
    : (props.candidate.originPortRaw ?? "");
  destinationQuery.value = correction?.destinationPort
    ? `${correction.destinationPort.unlocode} · ${correction.destinationPort.officialName}`
    : (props.candidate.destinationPortRaw ?? "");
  localError.value = "";
}

function clearPortSelection(scope: "origin" | "destination"): void {
  if (scope === "origin") draft.originPortCode = "";
  else draft.destinationPortCode = "";
}

function search(scope: "origin" | "destination"): void {
  const query = scope === "origin" ? originQuery.value : destinationQuery.value;
  if (!query.trim()) {
    localError.value = "请输入来源港口名或 UN/LOCODE 后再查找";
    return;
  }
  localError.value = "";
  emit("searchPort", scope, query.trim());
}

function selectPort(
  scope: "origin" | "destination",
  port: PostDepartureReferencePortV1,
): void {
  if (scope === "origin") {
    draft.originPortCode = port.unlocode;
    originQuery.value = `${port.unlocode} · ${port.officialName}`;
  } else {
    draft.destinationPortCode = port.unlocode;
    destinationQuery.value = `${port.unlocode} · ${port.officialName}`;
  }
}

function submit(): void {
  localError.value = "";
  emit("submit", { ...draft });
}

function emptyDraft(): CandidateCorrectionFormDraft {
  return {
    shipmentGrouping: null,
    originPortCode: "",
    destinationPortCode: "",
    departureLocal: "",
    sourceTimezone: "",
    evidenceRef: "",
  };
}

function editableGrouping(
  grouping: PostDepartureShipmentGroupingV1 | undefined,
): PostDepartureShipmentGroupingV1 | null {
  if (
    grouping?.kind === "existing_shipment" ||
    grouping?.kind === "new_independent_shipment"
  ) {
    return { ...grouping };
  }
  return null;
}

function toLocalInput(occurredAt: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(occurredAt))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const TIMEZONES = [
  ["Asia/Shanghai", "中国标准时间 · Asia/Shanghai"],
  ["America/Los_Angeles", "美国西部 · America/Los_Angeles"],
  ["America/New_York", "美国东部 · America/New_York"],
  ["America/Toronto", "加拿大东部 · America/Toronto"],
  ["Europe/London", "英国 · Europe/London"],
  ["Europe/Berlin", "德国 · Europe/Berlin"],
  ["Europe/Paris", "法国 · Europe/Paris"],
  ["Europe/Rome", "意大利 · Europe/Rome"],
  ["Europe/Madrid", "西班牙 · Europe/Madrid"],
  ["Europe/Dublin", "爱尔兰 · Europe/Dublin"],
  ["Europe/Bucharest", "罗马尼亚 · Europe/Bucharest"],
] as const;
</script>

<template>
  <section
    class="correction-form"
    aria-label="补齐接管信息"
    data-testid="handoff-correction-form"
  >
    <header class="pane-heading">
      <span class="pane-heading__title">
        <PencilLine :size="16" aria-hidden="true" />
        <b>正在处理 · {{ focusTitle }}</b>
        <small>候选 {{ candidate.containerNumber }}</small>
      </span>
      <span class="pane-heading__status">
        <i aria-hidden="true"></i>
        {{ editStatusLabel }}
      </span>
    </header>

    <form @submit.prevent="submit">
      <div ref="shipmentSection" class="grouping-section">
        <HandoffShipmentGroupingSelector
          v-model="draft.shipmentGrouping"
          :candidate="candidate"
          :options="shipmentOptions"
          :loading="loadingShipmentOptions"
          :error="shipmentOptionsError"
        />
      </div>

      <div class="port-fields">
        <fieldset class="port-fieldset">
          <legend>
            <span>确认起运港</span>
            <small class="source-badge"
              >来源：{{ candidate.originPortRaw || "未提供" }}</small
            >
          </legend>
          <div class="search-control">
            <input
              ref="originInput"
              v-model.trim="originQuery"
              :class="{ 'selected-input': draft.originPortCode }"
              aria-label="搜索起运港"
              placeholder="港口名或 UN/LOCODE"
              @input="clearPortSelection('origin')"
              @keydown.enter.prevent="search('origin')"
            />
            <button
              type="button"
              aria-label="查找起运港"
              title="查找起运港"
              :disabled="searchingOrigin"
              @click="search('origin')"
            >
              <Search :size="16" aria-hidden="true" />
            </button>
          </div>
          <div
            v-if="originOptions.length && !draft.originPortCode"
            class="port-options"
          >
            <button
              v-for="port in originOptions"
              :key="port.portId"
              type="button"
              :aria-pressed="draft.originPortCode === port.unlocode"
              @click="selectPort('origin', port)"
            >
              <Check
                v-if="draft.originPortCode === port.unlocode"
                :size="14"
                aria-hidden="true"
              />
              <span
                ><b>{{ port.unlocode }}</b> · {{ port.officialName }}</span
              >
            </button>
          </div>
        </fieldset>

        <fieldset class="port-fieldset">
          <legend>
            <span>确认目的港</span>
            <small class="source-badge"
              >来源：{{ candidate.destinationPortRaw || "未提供" }}</small
            >
          </legend>
          <div class="search-control">
            <input
              ref="destinationInput"
              v-model.trim="destinationQuery"
              :class="{ 'selected-input': draft.destinationPortCode }"
              aria-label="搜索目的港"
              placeholder="港口名或 UN/LOCODE"
              @input="clearPortSelection('destination')"
              @keydown.enter.prevent="search('destination')"
            />
            <button
              type="button"
              aria-label="查找目的港"
              title="查找目的港"
              :disabled="searchingDestination"
              @click="search('destination')"
            >
              <Search :size="16" aria-hidden="true" />
            </button>
          </div>
          <div
            v-if="destinationOptions.length && !draft.destinationPortCode"
            class="port-options"
          >
            <button
              v-for="port in destinationOptions"
              :key="port.portId"
              type="button"
              :aria-pressed="draft.destinationPortCode === port.unlocode"
              @click="selectPort('destination', port)"
            >
              <Check
                v-if="draft.destinationPortCode === port.unlocode"
                :size="14"
                aria-hidden="true"
              />
              <span
                ><b>{{ port.unlocode }}</b> · {{ port.officialName }}</span
              >
            </button>
          </div>
        </fieldset>
      </div>

      <fieldset class="departure-section">
        <legend class="visually-hidden">实际离港信息</legend>
        <div class="departure-fields">
          <label class="form-field">
            <span>
              实际离港
              <small class="source-badge"
                >来源 {{ candidate.departureRaw || "未提供" }}</small
              >
            </span>
            <input
              ref="departureInput"
              v-model="draft.departureLocal"
              aria-label="实际离港日期和时间"
              type="datetime-local"
            />
          </label>
          <label class="form-field">
            <span>来源时区</span>
            <select v-model="draft.sourceTimezone" aria-label="来源所在地时区">
              <option value="" disabled>请选择来源时区</option>
              <option
                v-for="[value, label] in TIMEZONES"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select>
          </label>
        </div>
        <label class="form-field">
          <span>离港依据</span>
          <input
            v-model.trim="draft.evidenceRef"
            aria-label="离港依据"
            maxlength="500"
            placeholder="附件链接、船司记录号或来源单据号"
          />
          <small>系统会登记并核验依据；无需填写证据 UUID。</small>
        </label>
      </fieldset>

      <p v-if="localError || error" class="form-error" role="alert">
        {{ localError || error }}
      </p>
      <div v-if="result" class="save-result" role="status">
        <Check :size="16" aria-hidden="true" />
        <span>
          <b>当前进度已保存</b>
          <small v-if="result.remainingIssues.length">
            还需处理：{{
              result.remainingIssues
                .map((issue) => handoffIssueAction(issue).title)
                .join("、")
            }}
          </small>
          <small v-else>当前没有待补内容。</small>
        </span>
      </div>

      <footer class="form-footer">
        <span class="system-handled">
          <i aria-hidden="true"></i>
          {{
            systemHandledCount
              ? `${systemHandledCount} 项已由系统处理`
              : "未填写项继续保留为待补"
          }}
        </span>
        <span class="form-actions">
          <button type="button" class="cancel-action" @click="emit('cancel')">
            <X :size="16" aria-hidden="true" />
            取消
          </button>
          <button type="submit" class="save-action" :disabled="saving">
            <Save :size="16" aria-hidden="true" />
            {{ saving ? "正在保存" : "保存当前进度" }}
          </button>
        </span>
      </footer>
    </form>
  </section>
</template>

<style scoped>
.correction-form {
  min-width: 0;
}

.pane-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-height: 58px;
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--line);
}

.pane-heading__title,
.pane-heading__status,
.form-actions,
.system-handled {
  display: flex;
  align-items: center;
}

.pane-heading__title {
  min-width: 0;
  gap: var(--space-2);
}

.pane-heading__title svg {
  flex: none;
  color: var(--brand-strong);
}

.pane-heading__title b,
.pane-heading__title small {
  overflow-wrap: anywhere;
}

.pane-heading__title small {
  padding-left: var(--space-1);
  font-weight: var(--weight-body);
}

.pane-heading__status {
  flex: none;
  gap: var(--space-2);
  color: var(--muted);
  font-size: var(--text-micro);
}

.pane-heading__status i,
.system-handled i {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--brand);
}

.form-field,
.save-result span {
  display: grid;
  gap: var(--space-1);
}

.pane-heading__title small,
.form-field small,
fieldset small,
.save-result small {
  color: var(--muted);
  font-size: var(--text-micro);
}

form {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.grouping-section,
.port-fields,
.port-fieldset,
.departure-section {
  min-width: 0;
}

.form-field > span,
.port-fieldset legend {
  color: var(--ink-soft);
  font-size: var(--text-label);
  font-weight: var(--weight-strong);
}

.form-field > span,
.port-fieldset legend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.source-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--brand-strong) !important;
  font-weight: var(--weight-body);
}

input,
select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

.port-fieldset,
.departure-section {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}

.port-fieldset legend {
  width: 100%;
  padding: 0 0 var(--space-2);
}

.port-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.departure-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px; /* style-scale-exempt: 无障碍隐藏输入的标准裁切偏移 */
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.search-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: var(--space-2);
}

.search-control button,
.port-options button,
.cancel-action,
.save-action {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}

.search-control .selected-input {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-weight: var(--weight-strong);
}

.port-options {
  display: grid;
  gap: var(--space-1);
  max-height: 150px;
  overflow: auto;
}

.port-options button {
  justify-content: flex-start;
  padding: var(--space-2) var(--space-3);
  text-align: left;
}

.port-options button[aria-pressed="true"] {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.form-error {
  margin: 0;
  color: var(--risk);
  font-size: var(--text-meta);
}

.save-result {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px dashed var(--line);
}

.system-handled {
  gap: var(--space-2);
  color: var(--muted);
  font-size: var(--text-meta);
}

.form-actions {
  gap: var(--space-2);
}

.cancel-action,
.save-action {
  padding: var(--space-2) var(--space-4);
  font-weight: var(--weight-strong);
}

.cancel-action {
  background: var(--surface);
  color: var(--ink-soft);
}

.save-action {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: var(--weight-strong);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 680px) {
  .pane-heading,
  .form-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .pane-heading__title {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .port-fields,
  .departure-fields {
    grid-template-columns: 1fr;
  }

  .form-actions,
  .cancel-action,
  .save-action {
    width: 100%;
  }
}
</style>
