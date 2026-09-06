<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type {
  AchievementCalendarDimension,
  AchievementCalendarView,
} from "./achievementCalendarContract";

const props = defineProps<{
  calendars: Readonly<
    Record<AchievementCalendarDimension, AchievementCalendarView>
  >;
}>();

const dimensions: readonly {
  key: AchievementCalendarDimension;
  label: string;
}[] = [
  { key: "month", label: "月" },
  { key: "week", label: "周" },
  { key: "day", label: "日" },
];
const activeDimension = shallowRef<AchievementCalendarDimension>("month");
const activeCalendar = computed(() => props.calendars[activeDimension.value]);
</script>

<template>
  <section class="achievement-block" aria-labelledby="achievement-title">
    <header class="achievement-head">
      <div>
        <b id="achievement-title">计划与达成</b>
        <span>完成 / 计划</span>
      </div>
      <div class="period-switch" role="group" aria-label="计划与达成时间维度">
        <button
          v-for="dimension in dimensions"
          :key="dimension.key"
          type="button"
          :aria-pressed="activeDimension === dimension.key"
          @click="activeDimension = dimension.key"
        >
          {{ dimension.label }}
        </button>
      </div>
    </header>

    <table class="achievement-calendar" aria-label="计划与达成，完成 / 计划">
      <thead>
        <tr>
          <th scope="col">节点</th>
          <th
            v-for="column in activeCalendar.columns"
            :key="column.key"
            scope="col"
            :class="{ current: column.isCurrent }"
            :aria-current="column.isCurrent ? 'date' : undefined"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in activeCalendar.rows" :key="row.stage">
          <th scope="row" :class="row.tone">{{ row.stage }}</th>
          <td
            v-for="column in activeCalendar.columns"
            :key="column.key"
            class="mono"
            :class="{ current: column.isCurrent }"
          >
            {{ row.values[column.key] ?? "缺数据" }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.achievement-block {
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.achievement-head,
.achievement-head > div:first-child {
  align-items: center;
  display: flex;
}

.achievement-head {
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.achievement-head > div:first-child {
  min-width: 0;
  gap: 6px;
}

.achievement-head b {
  font-size: 12px;
}

.achievement-head span {
  color: var(--muted);
  font-size: 10px;
}

.period-switch {
  display: inline-grid;
  grid-template-columns: repeat(3, 28px);
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
}

.period-switch button {
  width: 28px;
  height: 26px;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.period-switch button:last-child {
  border-right: 0;
}

.period-switch button[aria-pressed="true"] {
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 700;
}

.achievement-calendar {
  width: 100%;
  table-layout: fixed;
  border-spacing: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 11px;
  text-align: center;
}

.achievement-calendar th,
.achievement-calendar td {
  height: 27px;
  padding: 3px 5px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.achievement-calendar th:last-child,
.achievement-calendar td:last-child {
  border-right: 0;
}

.achievement-calendar tbody tr:last-child th,
.achievement-calendar tbody tr:last-child td {
  border-bottom: 0;
}

.achievement-calendar thead th {
  background: var(--surface-2);
  color: var(--muted);
  font-size: 10px;
  font-weight: 650;
}

.achievement-calendar thead th:first-child,
.achievement-calendar tbody th {
  width: 20%;
  text-align: left;
}

.achievement-calendar tbody th {
  background: var(--surface);
  font-weight: 650;
}

.achievement-calendar .current {
  background: var(--brand-soft);
  color: var(--ink);
}

.ok {
  color: var(--ok);
}

.warn {
  color: var(--warn);
}

.risk {
  color: var(--risk);
}

@media (max-width: 720px) {
  .period-switch {
    grid-template-columns: repeat(3, var(--touch-target));
  }

  .period-switch button {
    width: var(--touch-target);
    height: var(--touch-target);
  }

  .achievement-calendar {
    font-size: 9px;
  }

  .achievement-calendar th,
  .achievement-calendar td {
    padding-inline: 2px;
  }
}
</style>
