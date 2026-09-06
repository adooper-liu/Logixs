<script setup lang="ts">
import type { Tone } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

interface CapabilityRow {
  planId: string;
  parentPlanId: string;
  nodeKey: string;
  resource: string;
  provider: string;
  period: string;
  capacity: number;
  assigned: number;
  gap?: string;
  warning?: string;
}

interface AchievementRow {
  planId: string;
  nodeKey: string;
  containerRecordId: string;
  stage: string;
  month: string;
  week: string;
  day: string;
  rate: string;
  tone: Tone;
  resultRef: string;
}

defineProps<{
  capabilities: CapabilityRow[];
  achievements: AchievementRow[];
}>();
</script>

<template>
  <section class="planning-panel">
    <header class="panel-head">
      <h3>计划能力与执行达成</h3>
      <InfoTooltip
        label="查看计划执行关系"
        text="年度能力逐层分解到周期计划；执行结果以已落账业务事实统计。"
      />
    </header>
    <div class="panel-grid">
      <div class="capability">
        <div class="subhead">
          <b>资源负荷</b>
          <InfoTooltip
            label="查看资源负荷口径"
            text="对比周期能力与已分配运力，并保留父计划到执行计划的追溯关系。"
          />
        </div>
        <article
          v-for="row in capabilities"
          :key="`${row.resource}-${row.provider}`"
          class="capacity-row"
        >
          <div>
            <b>{{ row.resource }}</b
            ><span class="mono">{{ row.provider }} · {{ row.period }}</span
            ><small class="mono"
              >{{ row.parentPlanId }} → {{ row.planId }}</small
            >
          </div>
          <div class="load">
            <span
              ><i
                :style="{
                  width: `${Math.min(100, Math.round((row.assigned / row.capacity) * 100))}%`,
                }"
              ></i></span
            ><b class="mono">{{ row.assigned }}/{{ row.capacity }}</b>
          </div>
          <small :class="{ warn: row.warning }">{{
            row.warning || row.gap
          }}</small>
        </article>
      </div>
      <div class="achievement">
        <div class="subhead">
          <b>计划 vs 达成</b>
          <InfoTooltip
            label="查看计划达成口径"
            text="按月、周、日对比计划与已落账结果，不能用请求已接收代替达成。"
          />
        </div>
        <div class="achievement-table">
          <div class="achievement-row table-head">
            <span>节点</span><span>月</span><span>周</span><span>日</span
            ><span>达成</span>
          </div>
          <div
            v-for="row in achievements"
            :key="row.stage"
            class="achievement-row"
          >
            <router-link :to="`/container/${row.containerRecordId}`"
              ><b>{{ row.stage }}</b
              ><small class="mono"
                >{{ row.planId }} · {{ row.resultRef }}</small
              ></router-link
            >
            <span>{{ row.month }}</span
            ><span>{{ row.week }}</span
            ><span>{{ row.day }}</span
            ><strong :class="row.tone">{{ row.rate }}</strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.planning-panel {
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}
.panel-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  min-height: 40px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
.panel-head h3 {
  margin: 0;
  font-size: 14px;
}
.panel-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(420px, 1.1fr);
  gap: 14px;
  padding: 10px 12px;
}
.subhead {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}
.capacity-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(150px, 1fr) 90px;
  gap: 10px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.capacity-row > div:first-child {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.capacity-row span,
.capacity-row small {
  color: var(--muted);
  font-size: 10px;
}
.load {
  display: flex;
  align-items: center;
  gap: 8px;
}
.load > span {
  flex: 1;
  height: 6px;
  background: var(--ground);
}
.load i {
  display: block;
  height: 100%;
  background: var(--brand);
}
.load b {
  font-size: 11px;
}
.capacity-row small {
  text-align: right;
}
.capacity-row small.warn {
  color: var(--warn);
}
.achievement {
  overflow-x: auto;
}
.achievement-table {
  min-width: 430px;
}
.achievement-row {
  display: grid;
  grid-template-columns: 0.8fr repeat(4, 1fr);
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}
.achievement-row a {
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  text-decoration: none;
}
.achievement-row a small {
  color: var(--muted);
  font-size: 9px;
  overflow-wrap: anywhere;
}
.achievement-row span {
  color: var(--ink-soft);
}
.table-head span {
  color: var(--muted);
  font-size: 10px;
}
.achievement-row .ok {
  color: var(--ok);
}
.achievement-row .warn {
  color: var(--warn);
}
.achievement-row .risk {
  color: var(--risk);
}
@media (max-width: 900px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .panel-head {
    align-items: center;
    flex-direction: row;
  }
  .capacity-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .capacity-row > div:first-child {
    grid-column: 1 / -1;
  }
  .capacity-row > div:first-child small,
  .achievement-row a small {
    display: none;
  }
  .capacity-row small {
    text-align: left;
  }
}
</style>
