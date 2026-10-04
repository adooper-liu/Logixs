<script setup lang="ts">
import { CheckCircle2, CircleSlash, PackageCheck, Undo2 } from "@lucide/vue";
import { computed } from "vue";
import type {
  ProductInitiativeGap,
  ProductInitiativeOutcome,
} from "../../composables/useProductInitiativeDecision";
import type { ProductInitiativeReturnBasisV1 } from "@logix/contracts";
import {
  OBJECTIVE_MAX_LENGTH,
  outcomeHintFor,
  REASON_MAX_LENGTH,
} from "../../composables/useProductInitiativeDecision";

const props = withDefaults(
  defineProps<{
    outcome: ProductInitiativeOutcome;
    objective: string;
    reason: string;
    returnBasis?: ProductInitiativeReturnBasisV1 | "";
    /** 立项还差哪些、各在哪补；按钮文案与缺口清单都读它，不在本组件里另判一遍。 */
    gaps: readonly ProductInitiativeGap[];
    /** 不挡立项、但补了更扎实的要点。**不混进「还差 N 项」**。 */
    optionalGaps?: readonly string[];
    busy: boolean;
    /** 已立项是终态，不再提供任何判断动作。 */
    decided: boolean;
    returnPending?: boolean;
  }>(),
  { returnBasis: "", returnPending: false, optionalGaps: () => [] },
);

const emit = defineEmits<{
  changeOutcome: [outcome: ProductInitiativeOutcome];
  updateObjective: [value: string];
  updateReason: [value: string];
  updateReturnBasis: [value: ProductInitiativeReturnBasisV1 | ""];
  submit: [outcome: ProductInitiativeOutcome];
}>();

/**
 * 四个去向的唯一文案表。`reasonLabel` 只对需要原因的三个去向有意义 ——
 * 立项不写原因，它的门槛是目标结果加四项要点。
 */
const DESTINATIONS = [
  {
    outcome: "approve",
    label: "立项",
    summary: "要点齐备，形成结论交给产品开发",
    reasonLabel: null,
    action: "立项并交给产品开发",
  },
  {
    outcome: "defer",
    label: "暂缓",
    summary: "机会还在，但证据还不够，先放着",
    reasonLabel: "暂缓原因",
    action: "暂缓此机会",
  },
  {
    outcome: "reject",
    label: "不立项",
    summary: "判断不值得做，记下依据",
    reasonLabel: "不立项原因",
    action: "判定不立项",
  },
  {
    outcome: "return_to_market",
    label: "退回经营团队",
    summary: "上游证据不足或机会方向错误，请市场补充",
    reasonLabel: "市场需要补什么",
    action: "请求退回市场",
  },
] as const satisfies readonly {
  outcome: ProductInitiativeOutcome;
  label: string;
  summary: string;
  reasonLabel: string | null;
  action: string;
}[];

const ICONS: Record<ProductInitiativeOutcome, typeof PackageCheck> = {
  approve: PackageCheck,
  defer: CircleSlash,
  reject: CircleSlash,
  return_to_market: Undo2,
};

const current = computed(
  () =>
    DESTINATIONS.find((item) => item.outcome === props.outcome) ??
    DESTINATIONS[0],
);
const hint = computed(() =>
  outcomeHintFor({
    outcome: props.outcome,
    gaps: props.gaps,
    reason: props.reason,
  }),
);
/** 只有立项能被缺口挡住；其余三个去向没填原因也照样保存。 */
const blocked = computed(
  () => props.outcome === "approve" && props.gaps.length > 0,
);

function submit(): void {
  if (props.busy || props.decided || blocked.value) return;
  emit("submit", props.outcome);
}
</script>

<template>
  <section
    class="product-initiative-outcome"
    aria-labelledby="product-initiative-outcome-title"
  >
    <header>
      <small>现在做什么</small>
      <h2 id="product-initiative-outcome-title">形成立项结论</h2>
    </header>

    <div v-if="decided" class="closed">
      <CheckCircle2 :size="22" aria-hidden="true" />
      <b>{{ returnPending ? "等待市场接回" : "已立项" }}</b>
      <p v-if="returnPending">
        请求已写入，当前责任仍在选品；市场接回前不能再次判断。
      </p>
      <p v-else>
        立项交接已写入并进入 NPI
        待办，此处不再提供判断动作；同一机会如需新版本， 由 NPI 侧承接。
      </p>
    </div>

    <template v-else>
      <fieldset class="destinations">
        <legend>这一步把机会放到哪</legend>
        <label
          v-for="item in DESTINATIONS"
          :key="item.outcome"
          class="destination"
          :class="{ selected: item.outcome === outcome }"
        >
          <input
            type="radio"
            name="product-initiative-outcome"
            :value="item.outcome"
            :checked="item.outcome === outcome"
            @change="emit('changeOutcome', item.outcome)"
          />
          <span>
            <b>{{ item.label }}</b>
            <small>{{ item.summary }}</small>
          </span>
        </label>
      </fieldset>

      <div v-if="outcome === 'approve'" class="destination-input">
        <label class="field">
          <span>目标结果</span>
          <textarea
            :value="objective"
            aria-label="目标结果"
            :maxlength="OBJECTIVE_MAX_LENGTH"
            rows="2"
            placeholder="立项后要拿到什么结果，例如：把折叠出行包做成可发布版本"
            @input="
              emit(
                'updateObjective',
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </label>
        <p v-if="optionalGaps?.length" class="optional-gaps">
          还可以补（不挡立项）：{{ optionalGaps.join("、") }}
        </p>
        <div v-if="gaps.length" class="gap-list">
          <b>还不能立项</b>
          <ul>
            <li v-for="gap in gaps" :key="gap.label">
              <span>{{ gap.label }}</span>
              <small>
                {{
                  gap.panel === "objective"
                    ? "在上面的「目标结果」里补"
                    : "在评审要点面板里补"
                }}
              </small>
            </li>
          </ul>
        </div>
      </div>

      <div v-else class="destination-input">
        <label v-if="outcome === 'return_to_market'" class="field">
          <span>退回依据</span>
          <select
            :value="returnBasis"
            aria-label="退回依据"
            @change="
              emit(
                'updateReturnBasis',
                ($event.target as HTMLSelectElement).value as
                  ProductInitiativeReturnBasisV1 | '',
              )
            "
          >
            <option value="">请选择</option>
            <option value="insufficient_evidence">证据不足</option>
            <option value="wrong_direction">方向错误</option>
          </select>
        </label>
        <label class="field">
          <span>{{ current.reasonLabel }}</span>
          <textarea
            :value="reason"
            :aria-label="current.reasonLabel ?? '原因'"
            :maxlength="REASON_MAX_LENGTH"
            rows="3"
            placeholder="写清判断依据，便于经营团队与后续接手的人看懂"
            @input="
              emit('updateReason', ($event.target as HTMLTextAreaElement).value)
            "
          />
        </label>
        <p v-if="outcome === 'return_to_market'" class="optional-gaps">
          利润、供应或组合不成立，请选择“暂缓”或“不立项”。
        </p>
      </div>

      <div class="outcome-action">
        <p class="outcome-hint">
          <component :is="ICONS[outcome]" :size="16" aria-hidden="true" />
          {{ hint }}
        </p>
        <button
          type="button"
          class="outcome-submit"
          :disabled="busy || blocked"
          @click="submit"
        >
          {{ blocked ? hint : busy ? "正在保存" : current.action }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.product-initiative-outcome > header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.product-initiative-outcome > header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
.product-initiative-outcome h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-title);
}

.closed {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--ok-bg);
}
.closed > svg {
  color: var(--ok);
}
.closed b {
  color: var(--ink);
  font-size: var(--text-meta);
}
.closed p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.destinations {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-bottom: 1px solid var(--line);
}
.destinations legend {
  padding: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}
.destination {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  cursor: pointer;
}
.destination.selected {
  border-color: var(--brand-line);
  background: var(--brand-soft);
}
.destination span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}
.destination b {
  color: var(--ink);
  font-size: var(--text-label);
}
.destination small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.destination-input {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}
.field {
  display: grid;
  gap: var(--space-1);
}
.field > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}
.field textarea,
.field select {
  width: 100%;
  min-width: 0;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--text-label);
  box-sizing: border-box;
  resize: vertical;
}
.field textarea:focus-visible,
.field select:focus-visible {
  outline: 0;
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

/* 阻断与待补分轨：这是"不能立项"，用警示色而不是错误色。 */
.optional-gaps {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}
.gap-list {
  padding: var(--space-3);
  border-left: 3px solid var(--warn);
  background: var(--warn-bg);
}
.gap-list b {
  color: var(--warn);
  font-size: var(--text-label);
}
.gap-list ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}
.gap-list li {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--warn);
  border-radius: var(--radius-control);
  color: var(--warn);
  font-size: var(--text-micro);
}
.gap-list small {
  display: block;
  margin-top: var(--space-2);
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}

.outcome-action {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}
.outcome-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}
.outcome-hint svg {
  flex: none;
  color: var(--brand-strong);
}
.outcome-submit {
  min-height: var(--touch-target);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
.outcome-submit:disabled {
  border-color: var(--line-strong);
  background: var(--surface-2);
  color: var(--muted);
  cursor: not-allowed;
}
.outcome-submit:focus-visible,
.destination input:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}
</style>
