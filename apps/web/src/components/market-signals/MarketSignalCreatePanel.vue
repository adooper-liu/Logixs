<script setup lang="ts">
import { ChevronDown, FilePlus2, X } from "@lucide/vue";
import { reactive, shallowRef } from "vue";
import {
  createManualMarketSignalDraft,
  type ManualMarketSignalDraft,
} from "../../data/marketSignalScenarios";

const emit = defineEmits<{
  create: [draft: ManualMarketSignalDraft];
  cancel: [];
}>();

const draft = reactive(createManualMarketSignalDraft());
const showOptionalDetails = shallowRef(false);

function submit(): void {
  emit("create", { ...draft });
}
</script>

<template>
  <section class="create-panel" aria-labelledby="create-signal-title">
    <header class="create-heading">
      <span class="create-icon"
        ><FilePlus2 :size="18" aria-hidden="true"
      /></span>
      <div>
        <small>刚发现一条变化</small>
        <h2 id="create-signal-title">登记到待判断队列</h2>
        <p>先写清这是什么信号；其他信息缺失时可以直接保存，后续继续补。</p>
      </div>
      <button type="button" aria-label="关闭登记" @click="emit('cancel')">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <form class="create-form" @submit.prevent="submit">
      <label class="field field--title">
        <span>信号标题 <b>用于识别</b></span>
        <input
          v-model.trim="draft.title"
          required
          autofocus
          placeholder="例如：美国站紧凑型庭院收纳需求持续上升"
        />
      </label>

      <button
        type="button"
        class="optional-toggle"
        :aria-expanded="showOptionalDetails"
        @click="showOptionalDetails = !showOptionalDetails"
      >
        补充事实与来源
        <small>可选</small>
        <ChevronDown
          :size="16"
          :class="{ expanded: showOptionalDetails }"
          aria-hidden="true"
        />
      </button>

      <div v-if="showOptionalDetails" class="optional-fields">
        <label class="field">
          <span>市场 <small>可后补</small></span>
          <input v-model.trim="draft.market" placeholder="例如：美国" />
        </label>
        <label class="field">
          <span>渠道 <small>可后补</small></span>
          <input v-model.trim="draft.channel" placeholder="例如：Amazon US" />
        </label>
        <label class="field">
          <span>商品范围 <small>可后补</small></span>
          <input v-model.trim="draft.category" placeholder="例如：庭院收纳" />
        </label>

        <label class="field field--wide">
          <span>观察到的事实 <small>可后补</small></span>
          <textarea
            v-model.trim="draft.observedFact"
            rows="3"
            placeholder="只写已经发生或已经观察到的变化"
          />
        </label>
        <label class="field field--wide">
          <span>初步判断 <small>可后补</small></span>
          <textarea
            v-model.trim="draft.hypothesis"
            rows="3"
            placeholder="说明可能意味着什么，暂时不当作事实"
          />
        </label>

        <label class="field">
          <span>来源名称 <small>可后补</small></span>
          <input
            v-model.trim="draft.sourceName"
            placeholder="例如：美国站周报"
          />
        </label>
        <label class="field field--source-url">
          <span>来源链接 <small>可后补</small></span>
          <input
            v-model.trim="draft.sourceUrl"
            type="url"
            placeholder="https://"
          />
        </label>
      </div>

      <div class="create-actions">
        <button type="button" class="secondary-action" @click="emit('cancel')">
          取消
        </button>
        <button type="submit" class="primary-action">加入待判断</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.create-panel {
  margin-bottom: var(--space-3);
  border: 1px solid var(--brand-line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.create-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.create-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.create-heading small,
.field small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.create-heading h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-title);
}

.create-heading p {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.create-heading > button {
  width: var(--touch-target);
  height: var(--touch-target);
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.create-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-4);
}

.field {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.field--title,
.field--wide {
  grid-column: 1 / -1;
}

.optional-toggle {
  grid-column: 1 / -1;
  width: fit-content;
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 700;
}

.optional-toggle small {
  color: var(--muted);
  font-weight: 400;
}

.optional-toggle svg {
  transition: transform 120ms ease;
}

.optional-toggle svg.expanded {
  transform: rotate(180deg);
}

.optional-fields {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--line-strong);
  background: var(--surface-2);
}

.field--source-url {
  grid-column: span 2;
}

.field > span {
  color: var(--ink-soft);
  font-size: var(--text-label);
  font-weight: 700;
}

.field b {
  color: var(--risk);
  font-size: var(--text-micro);
}

.field input,
.field textarea {
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

.field textarea {
  resize: vertical;
}

.field input:focus-visible,
.field textarea:focus-visible,
.optional-toggle:focus-visible,
.create-heading > button:focus-visible,
.create-actions button:focus-visible {
  outline: 0;
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

.create-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-1);
}

.create-actions button {
  min-height: var(--touch-target);
  padding: 0 var(--space-4);
  border-radius: var(--radius-control);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 700;
}

.secondary-action {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink-soft);
}

.primary-action {
  border: 1px solid var(--brand);
  background: var(--brand);
  color: var(--on-brand);
}

@media (max-width: 680px) {
  .create-form {
    grid-template-columns: 1fr;
  }

  .field--title,
  .field--wide,
  .field--source-url,
  .optional-toggle,
  .optional-fields,
  .create-actions {
    grid-column: auto;
  }

  .optional-fields {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .optional-toggle svg {
    transition: none;
  }
}
</style>
