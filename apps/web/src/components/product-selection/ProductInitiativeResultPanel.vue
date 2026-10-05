<script setup lang="ts">
import type {
  ProductInitiativeDetailV1,
  ProductInitiativeEvidenceCandidateV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
} from "@logix/contracts";
import { computed } from "vue";
import type { ProductInitiativeReviewPointView } from "../../composables/useProductInitiativeDecision";
import {
  extractReviewSupplement,
  matchReviewOptionId,
  reviewPointOptions,
} from "../../data/productInitiativeReviewOptions";
import InfoTooltip from "../ui/InfoTooltip.vue";

type ProductInitiative = NonNullable<ProductInitiativeDetailV1["initiative"]>;

const props = defineProps<{
  title: string;
  marketCode: string | null | undefined;
  channelCode: string | null | undefined;
  categoryRef: string | null | undefined;
  opportunityStatement: string | null | undefined;
  observedFactSummary: string | null | undefined;
  hypothesis: string | null | undefined;
  supplementedFactCount: number;
  historicalMissingCategoryCount: number;
  initiative: ProductInitiative;
  points: readonly ProductInitiativeReviewPointView[];
  candidates: readonly ProductInitiativeEvidenceCandidateV1[];
  unitEconomicsSnapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
}>();

const evidenceById = computed(
  () =>
    new Map(
      props.candidates.map((candidate) => [candidate.evidenceId, candidate]),
    ),
);

const statusLabel = computed(() => {
  if (props.initiative.currentDestination === "handed_off") {
    return "已立项 · 已交 NPI";
  }
  if (props.initiative.currentDestination === "deferred") return "已暂缓立项";
  if (props.initiative.currentDestination === "rejected") return "未立项";
  if (props.initiative.currentDestination === "returned_to_market") {
    return "已退回经营团队";
  }
  return "立项结论已记录";
});

const opportunityScope = computed(() =>
  [
    props.marketCode?.trim() || "市场历史未记录",
    props.channelCode?.trim() || "渠道历史未记录",
    props.categoryRef?.trim() || "商品范围历史未记录",
  ].join(" · "),
);

function evidenceFor(point: ProductInitiativeReviewPointView) {
  return point.evidenceRefs
    .map((evidenceId) => evidenceById.value.get(evidenceId))
    .filter((candidate): candidate is ProductInitiativeEvidenceCandidateV1 =>
      Boolean(candidate),
    );
}

function staleCount(point: ProductInitiativeReviewPointView): number {
  return point.evidenceRefs.length - evidenceFor(point).length;
}

function conclusionSummary(point: ProductInitiativeReviewPointView): string {
  const optionId = matchReviewOptionId(point.code, point.conclusion);
  return (
    reviewPointOptions(point.code).find((option) => option.id === optionId)
      ?.sentence ??
    point.conclusion ??
    "历史记录未填写结论"
  );
}

function reviewNote(point: ProductInitiativeReviewPointView): string {
  return matchReviewOptionId(point.code, point.conclusion)
    ? extractReviewSupplement(point.code, point.conclusion)
    : "";
}

function contribution(scenario: "baseline" | "conservative"): string | null {
  const snapshot = props.unitEconomicsSnapshot;
  if (!snapshot) return null;
  const range = snapshot.scenarios[scenario].contribution;
  return `${range.min}～${range.max} ${snapshot.currencyCode}`;
}
</script>

<template>
  <section class="initiative-result" aria-labelledby="initiative-result-title">
    <header class="initiative-result__strip">
      <div class="initiative-result__decision">
        <span class="initiative-result__status">{{ statusLabel }}</span>
        <h2 id="initiative-result-title" class="initiative-result__title">
          {{ title }}
        </h2>
      </div>
      <dl class="initiative-result__handoff">
        <div>
          <dt>立项责任</dt>
          <dd>{{ initiative.responsibleActorId || "历史未记录" }}</dd>
        </div>
        <div>
          <dt>NPI 承接</dt>
          <dd>{{ initiative.receivingTeamOrRole || "历史未记录" }}</dd>
        </div>
      </dl>
    </header>

    <section
      class="initiative-result__block"
      aria-labelledby="opportunity-title"
    >
      <h2 id="opportunity-title">经营机会</h2>
      <div class="initiative-result__opportunity-meta">
        <b>{{ opportunityScope || "历史未记录" }}</b>
        <span
          v-if="supplementedFactCount"
          class="initiative-result__supplement"
        >
          含后补事实
          <InfoTooltip
            label="查看后补事实说明"
            text="交接后的信号事实已合并到本页；原交接快照保持不变。"
          />
        </span>
      </div>
      <p v-if="initiative.objective" class="initiative-result__objective">
        <b>验证目标：</b>{{ initiative.objective }}
      </p>
      <dl class="initiative-result__opportunity-facts">
        <div v-if="observedFactSummary">
          <dt>事实</dt>
          <dd>{{ observedFactSummary }}</dd>
        </div>
        <div v-if="hypothesis">
          <dt>经营判断</dt>
          <dd>{{ hypothesis }}</dd>
        </div>
        <div>
          <dt>证据</dt>
          <dd>{{ candidates.length }} 条</dd>
        </div>
      </dl>
      <details
        v-if="opportunityStatement"
        class="initiative-result__handoff-source"
      >
        <summary>交接原文</summary>
        <p>{{ opportunityStatement }}</p>
      </details>
      <p
        v-if="historicalMissingCategoryCount"
        class="initiative-result__history-note"
      >
        历史缺失 {{ historicalMissingCategoryCount }} 类
      </p>
    </section>

    <section
      class="initiative-result__block"
      aria-labelledby="investment-title"
    >
      <h2 id="investment-title">
        投资结论
        <InfoTooltip
          label="查看投资结论说明"
          text="贡献区间为立项时固化的单位经济快照，不代表当前实时测算。"
        />
      </h2>
      <div class="initiative-result__investment-layout">
        <dl class="initiative-result__investment-facts">
          <div>
            <dt>目标结果</dt>
            <dd>{{ initiative.objective || "历史未记录" }}</dd>
          </div>
          <div v-if="unitEconomicsSnapshot">
            <dt>基准贡献</dt>
            <dd>{{ contribution("baseline") }}</dd>
          </div>
          <div v-if="unitEconomicsSnapshot">
            <dt>保守贡献</dt>
            <dd>{{ contribution("conservative") }}</dd>
          </div>
          <div v-else class="initiative-result__history-note">
            历史立项未记录单位经济
          </div>
        </dl>
        <dl class="initiative-result__next-decision">
          <div>
            <dt>资源说明</dt>
            <dd>{{ initiative.resourceDescription || "历史未记录" }}</dd>
          </div>
          <div>
            <dt>目标日期</dt>
            <dd>{{ initiative.targetDate || "历史未记录" }}</dd>
          </div>
          <div>
            <dt>下一决策日期</dt>
            <dd>{{ initiative.nextDecisionDate || "历史未记录" }}</dd>
          </div>
          <div>
            <dt>下一决策问题</dt>
            <dd>{{ initiative.nextDecisionQuestion || "历史未记录" }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="initiative-result__block" aria-labelledby="review-title">
      <h2 id="review-title">评审依据</h2>
      <ul class="initiative-result__reviews">
        <li v-for="point in points" :key="point.code">
          <details>
            <summary>
              <b>{{ point.label }}</b>
              <span>{{ conclusionSummary(point) }}</span>
              <small>{{ point.evidenceRefs.length }} 项证据</small>
              <small v-if="staleCount(point)">
                {{ staleCount(point) }} 项引用失效
              </small>
            </summary>
            <div class="initiative-result__review-details">
              <p v-if="reviewNote(point)">
                <b>备注：</b>{{ reviewNote(point) }}
              </p>
              <div v-if="evidenceFor(point).length">
                <b>证据</b>
                <ul>
                  <li
                    v-for="evidence in evidenceFor(point)"
                    :key="evidence.evidenceId"
                  >
                    <b>{{ evidence.sourceName }}</b>
                    <span>{{ evidence.summary }}</span>
                    <small>{{ evidence.contentRef }}</small>
                  </li>
                </ul>
              </div>
              <p v-else>历史记录未保留可展示证据。</p>
            </div>
          </details>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.initiative-result {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
}
.initiative-result__strip,
.initiative-result__block {
  min-width: 0;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--line);
}
.initiative-result__strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: end;
}
.initiative-result__decision {
  min-width: 0;
}
.initiative-result__status {
  color: var(--ok);
  font-size: var(--text-micro);
  font-weight: 700;
}
.initiative-result h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
}
.initiative-result__title {
  display: block;
  font-size: var(--text-title);
  line-height: var(--leading-title);
}
.initiative-result__block > h2 {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-meta);
}
.initiative-result__handoff {
  display: flex;
  gap: var(--space-4);
  margin: 0;
}
.initiative-result dt {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}
.initiative-result dd {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-label);
  overflow-wrap: anywhere;
}
.initiative-result__opportunity-meta,
.initiative-result__supplement,
.initiative-result__opportunity-facts,
.initiative-result__investment-layout,
.initiative-result__investment-facts,
.initiative-result__next-decision {
  display: grid;
  gap: var(--space-2);
}
.initiative-result__opportunity-meta {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  margin-top: var(--space-2);
  color: var(--ink);
  font-size: var(--text-label);
}
.initiative-result__supplement {
  grid-auto-flow: column;
  align-items: center;
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}
.initiative-result__objective {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.initiative-result__opportunity-facts {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: var(--space-2) 0 0;
}
.initiative-result__opportunity-facts dd {
  color: var(--ink-soft);
}
.initiative-result__handoff-source {
  margin-top: var(--space-2);
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.initiative-result__handoff-source summary {
  color: var(--brand-strong);
  cursor: pointer;
  font-weight: 700;
}
.initiative-result__handoff-source p,
.initiative-result__history-note {
  margin: var(--space-2) 0 0;
}
.initiative-result__history-note {
  color: var(--muted);
  font-size: var(--text-micro);
}
.initiative-result__investment-layout {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-2);
}
.initiative-result__investment-facts,
.initiative-result__next-decision {
  margin: 0;
}
.initiative-result__investment-facts > div,
.initiative-result__next-decision > div {
  display: grid;
  grid-template-columns: minmax(94px, 0.45fr) minmax(0, 1fr);
  gap: var(--space-2);
  padding: var(--space-1) 0;
}
.initiative-result__investment-facts dd,
.initiative-result__next-decision dd {
  margin: 0;
}
.initiative-result__reviews {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}
.initiative-result__reviews details {
  border-bottom: 1px solid var(--line);
}
.initiative-result__reviews summary {
  display: grid;
  grid-template-columns: minmax(120px, 0.55fr) minmax(0, 1fr) auto auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) 0;
  color: var(--ink);
  cursor: pointer;
  font-size: var(--text-label);
}
.initiative-result__reviews summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.initiative-result__reviews summary small,
.initiative-result__review-details small {
  color: var(--muted);
  font-size: var(--text-micro);
  overflow-wrap: anywhere;
}
.initiative-result__review-details {
  display: grid;
  gap: var(--space-2);
  padding: 0 0 var(--space-3);
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.initiative-result__review-details p {
  margin: 0;
}
.initiative-result__review-details ul {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-1) 0 0;
  padding: 0;
  list-style: none;
}
.initiative-result__review-details li {
  display: grid;
  gap: var(--space-1);
  padding-left: var(--space-2);
  border-left: 2px solid var(--info);
}
@media (max-width: 680px) {
  .initiative-result {
    gap: var(--space-3);
    padding: var(--space-3);
  }
  .initiative-result__strip,
  .initiative-result__investment-layout {
    grid-template-columns: 1fr;
  }
  .initiative-result__handoff {
    gap: var(--space-3);
  }
  .initiative-result__opportunity-facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .initiative-result__investment-layout {
    gap: var(--space-2);
  }
  .initiative-result__investment-facts > div,
  .initiative-result__next-decision > div {
    grid-template-columns: 100px minmax(0, 1fr);
  }
  .initiative-result__reviews summary {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .initiative-result__reviews summary span {
    grid-column: 1 / -1;
  }
}
</style>
