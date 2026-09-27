<script setup lang="ts">
import { Save, X } from "@lucide/vue";
import { reactive, watch } from "vue";
import type {
  MarketSignalGap,
  MarketSignalSupplementDraft,
} from "../../data/marketSignalScenarios";

const props = defineProps<{ gap: MarketSignalGap }>();
const emit = defineEmits<{
  save: [draft: MarketSignalSupplementDraft];
  cancel: [];
}>();

const draft = reactive(createDraft(props.gap));

watch(
  () => props.gap.code,
  () => Object.assign(draft, createDraft(props.gap)),
);

function submit(): void {
  emit("save", { ...draft });
}

function createDraft(gap: MarketSignalGap): MarketSignalSupplementDraft {
  return {
    gapCode: gap.code,
    content: "",
    sourceName: "",
    sourceUrl: "",
  };
}
</script>

<template>
  <section class="gap-editor" :aria-labelledby="`gap-editor-${gap.code}`">
    <header>
      <div>
        <small>补充当前缺口</small>
        <h3 :id="`gap-editor-${gap.code}`">{{ gap.fieldLabel }}</h3>
      </div>
      <button type="button" aria-label="关闭补充表单" @click="emit('cancel')">
        <X :size="17" aria-hidden="true" />
      </button>
    </header>

    <form @submit.prevent="submit">
      <label v-if="gap.inputKind === 'evidence'" class="source-name">
        <span>资料来源 <small>可后补</small></span>
        <input
          v-model.trim="draft.sourceName"
          placeholder="例如：站点周报、客服记录或竞品调研"
        />
      </label>
      <label v-if="gap.inputKind === 'evidence'" class="source-url">
        <span>来源链接 <small>可后补</small></span>
        <input
          v-model.trim="draft.sourceUrl"
          type="url"
          placeholder="https://"
        />
      </label>
      <label class="gap-content">
        <span>补充内容</span>
        <input
          v-if="gap.inputKind === 'text'"
          v-model.trim="draft.content"
          :aria-label="gap.fieldLabel"
          :placeholder="gap.placeholder"
          required
          autofocus
        />
        <textarea
          v-else
          v-model.trim="draft.content"
          :aria-label="gap.fieldLabel"
          :placeholder="gap.placeholder"
          rows="3"
          required
          autofocus
        />
      </label>

      <div class="gap-actions">
        <button type="button" class="secondary-action" @click="emit('cancel')">
          取消
        </button>
        <button type="submit" class="primary-action">
          <Save :size="16" aria-hidden="true" />
          保存补充
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.gap-editor {
  border-top: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  background: var(--surface);
}

.gap-editor > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) 0;
}

.gap-editor header small,
.gap-editor label small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.gap-editor h3 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-meta);
}

.gap-editor header button {
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

.gap-editor form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.gap-editor label {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  color: var(--ink-soft);
  font-size: var(--text-label);
  font-weight: 700;
}

.gap-content,
.gap-actions {
  grid-column: 1 / -1;
}

.gap-editor input,
.gap-editor textarea {
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
}

.gap-editor input {
  min-height: var(--control-height);
}

.gap-editor textarea {
  resize: vertical;
}

.gap-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.gap-actions button {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);
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

.gap-editor button:focus-visible,
.gap-editor input:focus-visible,
.gap-editor textarea:focus-visible {
  outline: 0;
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

@media (max-width: 680px) {
  .gap-editor form {
    grid-template-columns: 1fr;
  }

  .gap-content,
  .gap-actions {
    grid-column: auto;
  }
}
</style>
