<script setup lang="ts">
import { computed } from "vue";
import { CircleCheck, Clock, TriangleAlert } from "@lucide/vue";
import type { Component } from "vue";
import type { TaskPrecondition } from "../../data/sample";

const props = defineProps<{
  conditions: TaskPrecondition[];
  attention?: boolean;
  openByDefault?: boolean;
}>();
const metCount = computed(
  () =>
    props.conditions.filter((condition) => condition.state === "met").length,
);
const allMet = computed(() => metCount.value === props.conditions.length);
const visibleConditions = computed(() =>
  allMet.value
    ? props.conditions
    : props.conditions.filter((condition) => condition.state !== "met"),
);

const stateMeta: Record<
  TaskPrecondition["state"],
  { label: string; icon: Component }
> = {
  met: { label: "已满足", icon: CircleCheck },
  waiting: { label: "等待中", icon: Clock },
  blocked: { label: "阻塞", icon: TriangleAlert },
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
        ><b>前置条件</b
        ><small>{{ metCount }}/{{ conditions.length }}</small></span
      >
      <strong :class="allMet ? 'met' : 'waiting'">{{
        allMet ? "已满足" : "需处理"
      }}</strong>
    </summary>

    <ul class="condition-list">
      <li v-for="condition in visibleConditions" :key="condition.id">
        <component
          :is="stateMeta[condition.state].icon"
          class="condition-icon"
          :class="condition.state"
          :size="17"
        />
        <span class="condition-copy"
          ><b>{{ condition.label }}</b
          ><small>{{ condition.detail }}</small></span
        >
        <span class="state-label" :class="condition.state">{{
          stateMeta[condition.state].label
        }}</span>
      </li>
    </ul>
    <p v-if="!allMet && metCount" class="collapsed-count">
      另有 {{ metCount }} 项已满足
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
.condition-list li {
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

.section-head small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
}

.section-head strong {
  font-size: 11px;
}

.condition-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  margin: 0;
  padding: 0 14px 8px;
  list-style: none;
}

.condition-list li {
  min-width: 0;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px dashed var(--line);
}

.condition-icon {
  flex: none;
  color: var(--muted);
}

.condition-icon.met,
.state-label.met {
  color: var(--ok);
}

.condition-icon.waiting,
.state-label.waiting {
  color: var(--warn);
}

.condition-icon.blocked,
.state-label.blocked {
  color: var(--risk);
}

.condition-copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.condition-copy b {
  font-size: 12px;
}

.condition-copy small {
  overflow-wrap: anywhere;
  color: var(--muted);
}

.state-label {
  flex: none;
  font-size: 11px;
  font-weight: 700;
}

.collapsed-count {
  margin: -3px 14px 8px;
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 720px) {
  .condition-list {
    grid-template-columns: 1fr;
  }
}
</style>
