<script setup lang="ts">
import { computed } from "vue";
import { CircleCheck, FileText, TriangleAlert } from "@lucide/vue";
import type { TaskRequiredInput } from "../../data/sample";

const props = defineProps<{
  inputs: TaskRequiredInput[];
  attention?: boolean;
  openByDefault?: boolean;
}>();
const emit = defineEmits<{ acknowledge: [inputId: string] }>();
const readyCount = computed(
  () => props.inputs.filter((input) => input.state === "ready").length,
);
const allReady = computed(() => readyCount.value === props.inputs.length);
const visibleInputs = computed(() =>
  allReady.value
    ? props.inputs
    : props.inputs.filter((input) => input.state !== "ready"),
);

const stateLabel: Record<TaskRequiredInput["state"], string> = {
  ready: "已就绪",
  pending: "待确认",
  missing: "缺失",
};
</script>

<template>
  <details
    class="section-band"
    :class="{ attention }"
    :open="attention || openByDefault"
  >
    <summary class="section-head">
      <span
        ><b>资料与资源</b
        ><small>{{ readyCount }}/{{ inputs.length }}</small></span
      >
      <strong :class="allReady ? 'ready' : 'pending'">{{
        allReady ? "已就绪" : "需确认"
      }}</strong>
    </summary>

    <ul class="input-list">
      <li v-for="input in visibleInputs" :key="input.id">
        <CircleCheck
          v-if="input.state === 'ready'"
          class="input-icon ready"
          :size="17"
        />
        <TriangleAlert
          v-else-if="input.state === 'missing'"
          class="input-icon missing"
          :size="17"
        />
        <FileText v-else class="input-icon pending" :size="17" />
        <span class="input-copy"
          ><b>{{ input.label }}</b
          ><small>{{ input.detail }}</small></span
        >
        <button
          v-if="input.state === 'pending' && input.actionLabel"
          class="secondary"
          type="button"
          @click="emit('acknowledge', input.id)"
        >
          {{ input.actionLabel }}
        </button>
        <span v-else class="state-label" :class="input.state">{{
          stateLabel[input.state]
        }}</span>
      </li>
    </ul>
    <p v-if="!allReady && readyCount" class="collapsed-count">
      另有 {{ readyCount }} 项已就绪
    </p>
  </details>
</template>

<style scoped>
.section-band {
  border-bottom: 1px solid var(--line);
}

.section-band.attention {
  border-bottom-color: transparent;
}

.section-band.attention .section-head b {
  color: var(--brand-strong);
}

.section-head,
.input-list li {
  display: flex;
  align-items: center;
}

.section-head {
  min-height: 42px;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  cursor: pointer;
  list-style: none;
}

.section-head::-webkit-details-marker {
  display: none;
}

.section-head > span {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
}

.section-head small,
.input-copy small {
  color: var(--muted);
}

.section-head small,
.section-head strong {
  font-size: 11px;
}

.section-head strong.ready {
  color: var(--ok);
}

.section-head strong.pending {
  color: var(--warn);
}

.input-list {
  margin: 0;
  padding: 0 14px 8px;
  list-style: none;
}

.input-list li {
  min-height: 42px;
  gap: 9px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--line);
}

.input-list li:last-child {
  border-bottom: 0;
}

.input-icon {
  flex: none;
  color: var(--warn);
}

.input-icon.ready,
.state-label.ready {
  color: var(--ok);
}

.input-icon.missing,
.state-label.missing {
  color: var(--risk);
}

.input-copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.input-copy b {
  font-size: 12px;
}

.input-copy small {
  overflow-wrap: anywhere;
}

.state-label {
  flex: none;
  color: var(--warn);
  font-size: 11px;
  font-weight: 700;
}

.secondary {
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--ink-soft);
  font-weight: 600;
  cursor: pointer;
}

.collapsed-count {
  margin: -3px 14px 8px;
  color: var(--muted);
  font-size: 10px;
}
</style>
