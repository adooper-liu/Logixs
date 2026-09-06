<script setup lang="ts">
import { computed } from "vue";
import type { ExceptionRecord, Tone } from "../../data/sample";
import AchievementCalendar from "./AchievementCalendar.vue";
import InfoTooltip from "../ui/InfoTooltip.vue";
import type {
  AchievementCalendarDimension,
  AchievementCalendarView,
} from "./achievementCalendarContract";

interface CapabilityRow {
  resource: string;
  provider: string;
  capacity: number;
  assigned: number;
  warning?: string;
}

interface FeeRow {
  tone: Tone;
}

interface MeetingDecision {
  status: string;
}

const props = defineProps<{
  achievementCalendars: Readonly<
    Record<AchievementCalendarDimension, AchievementCalendarView>
  >;
  capabilities: readonly CapabilityRow[];
  fees: readonly FeeRow[];
  exceptions: readonly ExceptionRecord[];
  decisions: readonly MeetingDecision[];
}>();

const utilization = (assigned: number, capacity: number) =>
  capacity > 0 ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0;

const openExceptions = computed(
  () =>
    props.exceptions.filter((item) => item.status !== "verified_closed").length,
);
const exposedFees = computed(
  () =>
    props.fees.filter((item) => item.tone === "risk" || item.tone === "warn")
      .length,
);
const pendingDecisions = computed(
  () => props.decisions.filter((item) => item.status !== "已关闭").length,
);
</script>

<template>
  <section class="analytics" aria-labelledby="analytics-title">
    <header class="panel-head">
      <div>
        <h2 id="analytics-title">执行与能力</h2>
        <InfoTooltip
          label="查看执行与能力范围"
          text="汇总计划达成、资源负荷和闭环结果，并可下钻到计划台。"
        />
      </div>
      <router-link to="/meso">进入计划台</router-link>
    </header>

    <div class="analytics-grid">
      <AchievementCalendar :calendars="achievementCalendars" />

      <section class="analysis-block" aria-labelledby="capacity-title">
        <header>
          <b id="capacity-title">资源负荷</b>
          <InfoTooltip
            label="查看资源负荷口径"
            text="负荷按已分配运力除以可用能力计算。"
          />
        </header>
        <div class="bar-list">
          <div
            v-for="row in capabilities"
            :key="row.resource"
            class="bar-row capacity-row"
          >
            <span :title="row.provider">{{ row.resource }}</span>
            <span
              class="bar-track"
              role="progressbar"
              :aria-label="`${row.resource}资源负荷`"
              :aria-valuenow="utilization(row.assigned, row.capacity)"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <i
                :class="row.warning ? 'warn' : 'ok'"
                :style="{
                  width: `${utilization(row.assigned, row.capacity)}%`,
                }"
              ></i>
            </span>
            <b class="mono" :class="{ warn: row.warning }"
              >{{ row.assigned }}/{{ row.capacity }}</b
            >
          </div>
        </div>
      </section>

      <section
        class="analysis-block closure-block"
        aria-labelledby="closure-title"
      >
        <header>
          <b id="closure-title">闭环控制</b>
          <InfoTooltip
            label="查看闭环控制口径"
            text="异常、费用暴露和会议决议都必须回到责任人、截止时间及后续动作。"
          />
        </header>
        <router-link to="/meso?dimension=exceptions" class="closure-row risk">
          <span>未验证关闭异常</span><b class="mono">{{ openExceptions }}</b>
        </router-link>
        <router-link to="/meso?dimension=fees" class="closure-row warn">
          <span>费用暴露类型</span><b class="mono">{{ exposedFees }}</b>
        </router-link>
        <router-link to="/meso?dimension=decisions" class="closure-row info">
          <span>待闭环会议决议</span><b class="mono">{{ pendingDecisions }}</b>
        </router-link>
      </section>
    </div>
  </section>
</template>

<style scoped>
.analytics {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-head {
  min-height: 32px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 0 2px;
}

.panel-head > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.panel-head h2 {
  margin: 0;
  font-size: 14px;
}

.panel-head a,
.analysis-block header :deep(.info-tooltip__trigger) {
  color: var(--muted);
  font-size: 10px;
}

.panel-head a {
  color: var(--brand);
  font-weight: 650;
  text-decoration: none;
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr minmax(220px, 0.72fr);
  gap: 12px;
}

.analysis-block {
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.analysis-block > header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.analysis-block > header b {
  font-size: 12px;
}

.bar-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 42px minmax(80px, 1fr) 38px;
  gap: 8px;
  align-items: center;
}

.bar-row > span:first-child,
.bar-row > b {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-row > b {
  text-align: right;
}

.bar-track {
  height: 8px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--ground);
}

.bar-track i {
  display: block;
  height: 100%;
  background: var(--info);
}

.bar-track i.ok {
  background: var(--ok);
}

.bar-track i.warn {
  background: var(--warn);
}

.bar-track i.risk {
  background: var(--risk);
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

.info {
  color: var(--info);
}

.closure-block {
  display: flex;
  flex-direction: column;
}

.closure-row {
  min-height: 34px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  border-top: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 10px;
  text-decoration: none;
}

.closure-row b {
  color: currentColor;
  font-size: 15px;
}

@media (max-width: 1000px) {
  .analytics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-block:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .analysis-block:last-child {
    grid-column: auto;
  }

  .closure-row {
    min-height: var(--touch-target);
  }
}
</style>
