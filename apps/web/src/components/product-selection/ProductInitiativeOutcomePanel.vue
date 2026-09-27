<script setup lang="ts">
import { CheckCircle2, CircleSlash, PackageCheck, Undo2 } from "@lucide/vue";
import { computed } from "vue";
import type { ProductInitiativeOutcome } from "../../composables/useProductInitiativeDecision";
import { outcomeHintFor } from "../../composables/useProductInitiativeDecision";

const props = defineProps<{
  outcome: ProductInitiativeOutcome;
  objective: string;
  reason: string;
  /** 立项还差哪些；按钮文案与缺口清单都读它，不在本组件里另判一遍。 */
  gaps: readonly string[];
  busy: boolean;
  /** 已立项是终态，不再提供任何判断动作。 */
  decided: boolean;
}>();

const emit = defineEmits<{
  changeOutcome: [outcome: ProductInitiativeOutcome];
  updateObjective: [value: string];
  updateReason: [value: string];
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
    summary: "该由经营团队重新判断",
    reasonLabel: "退回原因",
    action: "退回经营团队",
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
      <b>已立项</b>
      <p>
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
        <div v-if="gaps.length" class="gap-list">
          <b>还不能立项</b>
          <ul>
            <li v-for="gap in gaps" :key="gap">{{ gap }}</li>
          </ul>
          <small>上面的问题都在评审要点面板里就地补，补齐即可立项。</small>
        </div>
      </div>

      <div v-else class="destination-input">
        <label class="field">
          <span>{{ current.reasonLabel }}</span>
          <textarea
            :value="reason"
            :aria-label="current.reasonLabel ?? '原因'"
            rows="3"
            placeholder="写清判断依据，便于经营团队与后续接手的人看懂"
            @input="
              emit('updateReason', ($event.target as HTMLTextAreaElement).value)
            "
          />
        </label>
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
  gap: 2px;
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
.field textarea {
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
.field textarea:focus-visible {
  outline: 0;
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

/* 阻断与待补分轨：这是"不能立项"，用警示色而不是错误色。 */
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
  margin-top: 2px;
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
