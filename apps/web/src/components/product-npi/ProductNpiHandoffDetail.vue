<script setup lang="ts">
import { FileText } from "@lucide/vue";
import type { ProductInitiativeNpiQueueEntryV1 } from "@logix/contracts";
import { REVIEW_POINTS } from "../../composables/useProductInitiativeDecision";
import ProductInitiativeUnitEconomicsSnapshot from "../product-selection/ProductInitiativeUnitEconomicsSnapshot.vue";

/**
 * 立项快照：选品交接时锁定的原样内容，**只读**。
 * NPI 不得改写立项阶段的任何结论 —— 要改只能走退回或新版本，不在这里。
 */
defineProps<{ entry: ProductInitiativeNpiQueueEntryV1 }>();

const LABELS = new Map(REVIEW_POINTS.map((point) => [point.code, point.label]));

function pointLabel(code: string): string {
  return LABELS.get(code as (typeof REVIEW_POINTS)[number]["code"]) ?? code;
}
</script>

<template>
  <section class="npi-detail">
    <header>
      <small>这一票是什么</small>
      <h2>{{ entry.handoff.objective }}</h2>
      <p class="source">
        来源信号 {{ entry.handoff.signalId.slice(0, 8) }} ·
        {{ entry.handoff.marketCode || "未填市场" }} · 交接于
        {{ new Date(entry.handoff.createdAt).toLocaleString("zh-CN") }}
      </p>
    </header>

    <div class="block">
      <h3><FileText :size="15" />机会说明</h3>
      <p>{{ entry.handoff.userProblem || "交接时未填写机会说明" }}</p>
    </div>

    <div class="block">
      <h3>资源与责任承诺（只读）</h3>
      <dl class="commitment">
        <div>
          <dt>立项责任人</dt>
          <dd>
            {{
              entry.handoff.responsibilityAccepted === true
                ? entry.handoff.responsibleActorId
                : "历史交接未记录"
            }}
          </dd>
        </div>
        <div>
          <dt>承接团队或岗位</dt>
          <dd>{{ entry.handoff.receivingTeamOrRole || "历史交接未记录" }}</dd>
        </div>
        <div>
          <dt>资源说明</dt>
          <dd>{{ entry.handoff.resourceDescription || "历史交接未记录" }}</dd>
        </div>
        <div>
          <dt>目标日期</dt>
          <dd>{{ entry.handoff.targetDate || "历史交接未记录" }}</dd>
        </div>
        <div>
          <dt>下一决策点</dt>
          <dd>
            {{ entry.handoff.nextDecisionDate || "历史交接未记录" }} ·
            {{ entry.handoff.nextDecisionQuestion || "未记录决策问题" }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="block">
      <h3>立项阶段的四项结论（只读）</h3>
      <ul>
        <li v-for="point in entry.handoff.reviewPoints" :key="point.code">
          <b>{{ pointLabel(point.code) }}</b>
          <span>{{ point.conclusion || "交接时未写结论" }}</span>
          <small>
            依据 {{ point.evidenceRefs.length }} 项
            <template v-if="point.evidenceRefs.length === 0">（无）</template>
          </small>
        </li>
      </ul>
      <p v-if="entry.handoff.reviewPoints.length === 0" class="empty">
        交接快照里没有评审要点
      </p>
    </div>

    <div class="block">
      <h3>单位经济快照（只读）</h3>
      <ProductInitiativeUnitEconomicsSnapshot
        v-if="entry.handoff.unitEconomicsSnapshot"
        :snapshot="entry.handoff.unitEconomicsSnapshot"
        :negative-conservative-reason="entry.handoff.negativeConservativeReason"
      />
      <p v-else class="empty">历史交接未记录</p>
    </div>

    <p class="discipline">
      这里的结论属于立项阶段，本岗位只读。要改，只能由选品侧走退回或新版本。
    </p>
  </section>
</template>

<style scoped>
header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
  line-height: var(--leading-body);
}
.source {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.block {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  font-size: var(--text-meta);
  font-weight: 600;
}
.block p {
  margin: 0;
  line-height: var(--leading-body);
}
.commitment {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}
.commitment > div {
  display: grid;
  grid-template-columns: minmax(90px, 0.35fr) minmax(0, 1fr);
  gap: var(--space-2);
}
.commitment dt {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}
.commitment dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-label);
}
ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: grid;
  gap: var(--space-1);
}
li small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.discipline {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}
.empty {
  color: var(--ink-soft);
  font-size: var(--text-meta);
}
</style>
