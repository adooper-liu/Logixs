<script setup lang="ts">
import { computed, getCurrentInstance } from "vue";
import type { WorkbenchPaneState } from "./workbenchLayout.types";

withDefaults(
  defineProps<{
    id: string;
    title: string;
    regionLabel: string;
    count?: number;
    state?: WorkbenchPaneState;
    scroll?: "contained" | "content";
  }>(),
  { count: undefined, state: () => ({ kind: "ready" }), scroll: "contained" },
);

const emit = defineEmits<{
  retry: [];
}>();

const instance = getCurrentInstance();
const canRetry = computed(() => Boolean(instance?.vnode.props?.onRetry));
</script>

<template>
  <section
    :id="id"
    class="workbench-pane workbench-pane--bounded"
    :aria-label="regionLabel"
  >
    <header class="workbench-pane__header">
      <h2>{{ title }}</h2>
      <span v-if="count !== undefined" class="workbench-pane__count">{{
        count
      }}</span>
      <slot name="actions" />
    </header>
    <div
      class="workbench-pane__scroll workbench-pane__scroll--independent"
      :class="{ 'workbench-pane__scroll--content': scroll === 'content' }"
    >
      <slot name="summary" />
      <slot v-if="state.kind === 'ready'" />
      <slot v-else-if="state.kind === 'loading'" name="loading">
        <p class="workbench-pane__state" role="status">{{ state.message }}</p>
      </slot>
      <slot v-else-if="state.kind === 'empty'" name="empty">
        <p class="workbench-pane__state">{{ state.message }}</p>
      </slot>
      <slot v-else-if="state.kind === 'error'" name="error" :state="state">
        <div
          class="workbench-pane__state workbench-pane__state--error"
          role="alert"
        >
          <p>{{ state.message }}</p>
          <small v-if="state.traceId">追踪 ID：{{ state.traceId }}</small>
          <button v-if="canRetry" type="button" @click="emit('retry')">
            重试
          </button>
        </div>
      </slot>
      <slot v-else name="receipt">
        <p class="workbench-pane__state" role="status">{{ state.message }}</p>
      </slot>
    </div>
  </section>
</template>

<style scoped>
.workbench-pane {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.workbench-pane__header {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.workbench-pane__header h2 {
  min-width: 0;
  flex: 1;
  margin: 0;
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.workbench-pane__count {
  color: var(--muted);
  font-size: var(--text-micro);
  font-variant-numeric: tabular-nums;
}

.workbench-pane__scroll {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.workbench-pane__scroll--content {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
}

.workbench-pane__state {
  margin: 0;
  padding: var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.workbench-pane__state--error {
  display: grid;
  gap: var(--space-2);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.workbench-pane__state--error p,
.workbench-pane__state--error small {
  margin: 0;
}

.workbench-pane__state--error button {
  justify-self: start;
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--risk);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--risk);
  cursor: pointer;
  font: inherit;
}
</style>
