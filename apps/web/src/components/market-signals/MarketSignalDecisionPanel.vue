<script setup lang="ts">
import { Archive, Ban, CalendarClock, Eye, Send, XCircle } from "@lucide/vue";
import { computed } from "vue";
import type { MarketSignalDecisionDraft } from "../../data/marketSignalScenarios";

const emit = defineEmits<{
  submit: [];
}>();
const props = defineProps<{
  activeValidation?: {
    responsibleActorId: string;
    nextReviewDate: string;
    watchFocus: string | null;
    waitingReason: string | null;
  } | null;
  actorId?: string | null;
  busy?: boolean;
  closed?: boolean;
  closedLabel?: string;
}>();

const model = defineModel<MarketSignalDecisionDraft>({ required: true });

const isClose = computed(
  () => model.value.decision === "void" || model.value.decision === "archive",
);
const ownedByAnother = computed(
  () =>
    Boolean(props.activeValidation?.responsibleActorId) &&
    props.activeValidation?.responsibleActorId !== props.actorId,
);
const watchComplete = computed(() =>
  Boolean(model.value.nextReviewDate && model.value.watchFocus.trim()),
);

const actionLabel = computed(() => {
  if (model.value.decision === "watch") {
    if (ownedByAnother.value) return "当前验证由其他负责人承担";
    return watchComplete.value
      ? props.activeValidation
        ? "更新我的验证承诺"
        : "由我负责并安排验证"
      : "补齐日期和验证重点";
  }
  if (model.value.decision === "dismiss") {
    return model.value.dismissReason ? "记录不采纳" : "保存，原因稍后补";
  }
  if (model.value.decision === "void") {
    return model.value.judgmentNote.trim() ? "确认作废" : "保存，理由稍后补";
  }
  if (model.value.decision === "archive") {
    return model.value.judgmentNote.trim() ? "确认归档" : "保存，理由稍后补";
  }
  return "交给选品评估";
});

function updateField(
  field: keyof MarketSignalDecisionDraft,
  event: Event,
): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
  if (!target) return;
  model.value = { ...model.value, [field]: target.value };
}

function chooseDecision(decision: MarketSignalDecisionDraft["decision"]): void {
  model.value = { ...model.value, decision };
}
</script>

<template>
  <div v-if="closed" class="decision-panel closed-panel">
    <header class="pane-heading">
      <div>
        <small>现在做什么</small>
        <h2>这条信号已关闭</h2>
      </div>
    </header>
    <p class="closed-copy">
      {{ closedLabel || "已作废或归档，只读回看；本片不支持重开。" }}
    </p>
  </div>

  <form v-else class="decision-panel" @submit.prevent="emit('submit')">
    <header class="pane-heading">
      <div>
        <small>现在做什么</small>
        <h2>给这条信号一个去向</h2>
      </div>
    </header>

    <fieldset class="decision-options">
      <legend>处理方式</legend>
      <label :class="{ selected: model.decision === 'watch' }">
        <input
          type="radio"
          name="market-signal-decision"
          value="watch"
          :checked="model.decision === 'watch'"
          @change="chooseDecision('watch')"
        />
        <Eye :size="17" aria-hidden="true" />
        <span
          ><b>安排下一项验证</b
          ><small>由我负责，明确验证重点和检查日</small></span
        >
      </label>
      <label :class="{ selected: model.decision === 'handoff' }">
        <input
          type="radio"
          name="market-signal-decision"
          value="handoff"
          :checked="model.decision === 'handoff'"
          @change="chooseDecision('handoff')"
        />
        <Send :size="17" aria-hidden="true" />
        <span><b>交给选品评估</b><small>值得进一步判断是否立项</small></span>
      </label>
      <label :class="{ selected: model.decision === 'dismiss' }">
        <input
          type="radio"
          name="market-signal-decision"
          value="dismiss"
          :checked="model.decision === 'dismiss'"
          @change="chooseDecision('dismiss')"
        />
        <XCircle :size="17" aria-hidden="true" />
        <span><b>不采纳</b><small>保留来源和本次判断</small></span>
      </label>
      <label :class="{ selected: model.decision === 'void' }">
        <input
          type="radio"
          name="market-signal-decision"
          value="void"
          :checked="model.decision === 'void'"
          @change="chooseDecision('void')"
        />
        <Ban :size="17" aria-hidden="true" />
        <span><b>作废</b><small>错登、重复或不再跟进</small></span>
      </label>
      <label :class="{ selected: model.decision === 'archive' }">
        <input
          type="radio"
          name="market-signal-decision"
          value="archive"
          :checked="model.decision === 'archive'"
          @change="chooseDecision('archive')"
        />
        <Archive :size="17" aria-hidden="true" />
        <span><b>归档</b><small>结案保留，只读回看</small></span>
      </label>
    </fieldset>

    <div v-if="model.decision === 'watch'" class="decision-fields">
      <p v-if="ownedByAnother" class="validation-owner-conflict" role="status">
        当前验证由
        {{
          activeValidation?.responsibleActorId
        }}
        负责。本片不支持静默接管或转派。
      </p>
      <label>
        <span>下次检查日期</span>
        <input
          type="date"
          :value="model.nextReviewDate"
          @input="updateField('nextReviewDate', $event)"
        />
      </label>
      <label>
        <span>这次要验证什么</span>
        <textarea
          rows="3"
          aria-label="这次要验证什么"
          :value="model.watchFocus"
          placeholder="例如：搜索趋势是否持续、价格带是否稳定"
          @input="updateField('watchFocus', $event)"
        />
      </label>
      <label>
        <span>当前在等什么 <small>可选</small></span>
        <textarea
          rows="2"
          aria-label="当前在等什么"
          :value="model.waitingReason"
          placeholder="例如：等待第二客服队列导出"
          @input="updateField('waitingReason', $event)"
        />
      </label>
    </div>

    <div v-else-if="model.decision === 'handoff'" class="decision-fields">
      <div class="handoff-destination">
        <span>接收方</span>
        <b>选品团队队列</b>
        <small>由选品人员领取后形成实际负责人</small>
      </div>
      <label>
        <span>机会说明 <small>可后补</small></span>
        <textarea
          rows="4"
          :value="model.opportunityStatement"
          placeholder="用一句话说明希望选品进一步验证什么"
          @input="updateField('opportunityStatement', $event)"
        />
      </label>
    </div>

    <div v-else-if="model.decision === 'dismiss'" class="decision-fields">
      <label>
        <span>不采纳原因 <small>可后补</small></span>
        <select
          :value="model.dismissReason"
          @change="updateField('dismissReason', $event)"
        >
          <option value="">稍后补充</option>
          <option>证据不足</option>
          <option>不符合当前经营方向</option>
          <option>已有商品覆盖</option>
          <option>时机不合适</option>
        </select>
      </label>
    </div>

    <div v-else-if="isClose" class="decision-fields">
      <label>
        <span
          >{{ model.decision === "void" ? "作废" : "归档" }}理由
          <small>可后补</small></span
        >
        <textarea
          rows="3"
          :value="model.judgmentNote"
          :placeholder="
            model.decision === 'void'
              ? '例如：重复登记、来源有误、不再跟进'
              : '例如：观察结束、结论已沉淀'
          "
          @input="updateField('judgmentNote', $event)"
        />
      </label>
    </div>

    <label v-if="!isClose" class="judgment-note">
      <span>本次判断依据 <small>可后补</small></span>
      <textarea
        rows="3"
        :value="model.judgmentNote"
        placeholder="只写影响本次决定的关键信息"
        @input="updateField('judgmentNote', $event)"
      />
    </label>

    <button
      class="primary-action"
      type="submit"
      :disabled="
        busy ||
        (model.decision === 'watch' && (!watchComplete || ownedByAnother))
      "
    >
      <CalendarClock
        v-if="model.decision === 'watch'"
        :size="17"
        aria-hidden="true"
      />
      <Send
        v-else-if="model.decision === 'handoff'"
        :size="17"
        aria-hidden="true"
      />
      <Ban
        v-else-if="model.decision === 'void'"
        :size="17"
        aria-hidden="true"
      />
      <Archive
        v-else-if="model.decision === 'archive'"
        :size="17"
        aria-hidden="true"
      />
      <XCircle v-else :size="17" aria-hidden="true" />
      {{ busy ? "正在保存" : actionLabel }}
    </button>
  </form>
</template>

<style scoped>
.decision-panel {
  min-width: 0;
}

.pane-heading {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pane-heading small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.pane-heading h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-title);
}

.validation-owner-conflict {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--warn);
  background: var(--warn-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.decision-options {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-4);
  border: 0;
  border-bottom: 1px solid var(--line);
}

.decision-options legend {
  padding: 0;
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.decision-options label {
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  cursor: pointer;
}

.decision-options label.selected {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.decision-options input {
  accent-color: var(--brand);
}

.decision-options svg {
  color: var(--brand-strong);
}

.decision-options span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.decision-options b {
  color: var(--ink);
  font-size: var(--text-label);
}

.decision-options small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.decision-fields,
.judgment-note {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.decision-fields label,
.judgment-note {
  display: grid;
  gap: var(--space-2);
}

.handoff-destination {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  border-left: 3px solid var(--brand);
  background: var(--brand-soft);
}

.handoff-destination > span,
.handoff-destination > small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.handoff-destination > b {
  color: var(--ink);
  font-size: var(--text-label);
}

.decision-fields label > span,
.judgment-note > span {
  color: var(--ink-soft);
  font-size: var(--text-label);
  font-weight: 700;
}

.decision-fields small,
.judgment-note small {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 400;
}

.decision-fields input,
.decision-fields select,
.decision-fields textarea,
.judgment-note textarea {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height);
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--text-label);
  box-sizing: border-box;
}

.decision-fields textarea,
.judgment-note textarea {
  resize: vertical;
}

.decision-fields input:focus-visible,
.decision-fields select:focus-visible,
.decision-fields textarea:focus-visible,
.judgment-note textarea:focus-visible {
  outline: 0;
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

.primary-action {
  min-height: var(--touch-target);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: calc(100% - var(--space-8));
  margin: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 700;
}

.primary-action:hover {
  background: var(--brand-strong);
}

.primary-action:disabled {
  cursor: wait;
  opacity: 0.65;
}

.primary-action:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.closed-copy {
  margin: 0;
  padding: var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}
</style>
