<script setup lang="ts">
import type { ExceptionRecord, Tone } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

interface CycleRow {
  containerRecordId: string;
  stage: string;
  planned: string;
  estimated: string;
  actual: string;
  basis: string;
  eventRefs: string;
}
interface FeeRow {
  feeId: string;
  containerRecordId: string;
  type: string;
  stage: string;
  amount: string;
  period: string;
  authority: string;
  ruleRef: string;
  tone: Tone;
}
interface MeetingDecision {
  decisionId: string;
  meeting: string;
  decision: string;
  owner: string;
  dueAt: string;
  status: string;
  sourceRef: string;
  followUpTaskId: string;
  targetPlanId: string;
}

defineProps<{
  cycles: CycleRow[];
  fees: FeeRow[];
  exceptions: ExceptionRecord[];
  decisions: MeetingDecision[];
}>();
</script>

<template>
  <section class="closure-panel">
    <header class="panel-head">
      <h3>时效、费用、异常与复盘闭环</h3>
      <InfoTooltip
        label="查看分析闭环关系"
        text="时效、费用和异常分析必须形成责任动作，并回流会议决议与后续资源计划。"
      />
    </header>
    <div class="analysis-grid">
      <section id="cycles" class="analysis-section">
        <div class="subhead">
          <b>周期时效</b>
          <InfoTooltip
            label="查看周期时效口径"
            text="计划、预计和实际时间分轨展示；实际值必须来自可追溯事件。"
          />
        </div>
        <article v-for="row in cycles" :key="row.stage" class="cycle-row">
          <router-link :to="`/container/${row.containerRecordId}`"
            ><b>{{ row.stage }}</b></router-link
          ><span>{{ row.planned }}</span
          ><span>{{ row.estimated }}</span
          ><strong>{{ row.actual }}</strong
          ><small>{{ row.basis }} · {{ row.eventRefs }}</small>
        </article>
      </section>
      <section id="fees" class="analysis-section">
        <div class="subhead">
          <b>费用风险</b>
          <InfoTooltip
            label="查看费用风险口径"
            text="费用按类型分开核算，并同时展示账单或计费规则等权威依据。"
          />
        </div>
        <article v-for="row in fees" :key="row.type" class="fee-row">
          <div>
            <router-link :to="`/container/${row.containerRecordId}`"
              ><b>{{ row.type }}</b></router-link
            ><span>{{ row.period }} · {{ row.feeId }}</span>
          </div>
          <div>
            <strong :class="row.tone">{{ row.stage }} · {{ row.amount }}</strong
            ><small>{{ row.authority }} · {{ row.ruleRef }}</small>
          </div>
        </article>
      </section>
      <section id="exceptions" class="analysis-section">
        <div class="subhead">
          <b>异常与改善</b>
          <InfoTooltip
            label="查看异常关闭口径"
            text="异常已处理不等于已关闭；关闭前必须验证结果并保留来源任务。"
          />
        </div>
        <article v-for="row in exceptions" :key="row.id" class="exception-row">
          <div>
            <b>{{ row.issue }}</b
            ><span class="mono"
              >{{ row.id }} · {{ row.containerRecordId }}</span
            >
          </div>
          <div>
            <strong>{{ row.statusLabel }}</strong
            ><span>{{ row.owner }} · {{ row.dueAt }}</span>
          </div>
          <p>{{ row.next }}</p>
          <router-link
            class="trace-link mono"
            :to="`/tasks?task=${row.sourceTaskId}`"
            >来源任务 {{ row.sourceTaskId }}</router-link
          >
        </article>
      </section>
      <section id="decisions" class="analysis-section">
        <div class="subhead">
          <b>会议决议</b>
          <InfoTooltip
            label="查看会议决议闭环"
            text="会议只读取运营事实；形成的决议必须进入任务、责任人和截止时间追踪。"
          />
        </div>
        <article
          v-for="row in decisions"
          :key="`${row.meeting}-${row.decision}`"
          class="decision-row"
        >
          <div>
            <b>{{ row.meeting }}</b
            ><span>{{ row.decision }} · {{ row.decisionId }}</span>
          </div>
          <div>
            <strong>{{ row.status }}</strong
            ><span>{{ row.owner }} · {{ row.dueAt }}</span>
          </div>
          <router-link
            class="trace-link mono"
            :to="`/tasks?task=${row.followUpTaskId}`"
            >{{ row.sourceRef }} → {{ row.targetPlanId }}</router-link
          >
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.closure-panel {
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
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.analysis-section {
  min-width: 0;
  padding: 10px 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.analysis-section:nth-child(2n) {
  border-right: 0;
}
.analysis-section:nth-last-child(-n + 2) {
  border-bottom: 0;
}
.subhead {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}
.cycle-row {
  display: grid;
  grid-template-columns: 0.7fr repeat(3, 0.7fr) 1.8fr;
  gap: 7px;
  padding: 5px 0;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
}
.cycle-row a,
.fee-row a {
  color: var(--ink);
  text-decoration: none;
}
.cycle-row span,
.cycle-row small {
  color: var(--muted);
}
.fee-row,
.exception-row,
.decision-row {
  display: grid;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.fee-row {
  grid-template-columns: 0.8fr 1.2fr;
}
.exception-row {
  grid-template-columns: 1.1fr 0.8fr;
}
.decision-row {
  grid-template-columns: 1.2fr 0.8fr;
}
.fee-row > div,
.exception-row > div,
.decision-row > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.fee-row span,
.fee-row small,
.exception-row span,
.decision-row span {
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}
.fee-row strong,
.exception-row strong,
.decision-row strong {
  font-size: 11px;
}
.fee-row .ok {
  color: var(--ok);
}
.fee-row .warn {
  color: var(--warn);
}
.fee-row .risk {
  color: var(--risk);
}
.fee-row .muted {
  color: var(--muted);
}
.exception-row p {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--ink-soft);
  font-size: 11px;
}
.trace-link {
  grid-column: 1 / -1;
  color: var(--brand);
  font-size: 10px;
  text-decoration: none;
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  .analysis-section {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .analysis-section:nth-last-child(2) {
    border-bottom: 1px solid var(--line);
  }
}
@media (max-width: 720px) {
  .panel-head {
    align-items: center;
    flex-direction: row;
  }
  .cycle-row {
    grid-template-columns: repeat(4, 1fr);
  }
  .cycle-row small {
    grid-column: 1 / -1;
  }
  .fee-row,
  .exception-row,
  .decision-row {
    grid-template-columns: 1fr;
  }
}
</style>
