<script setup lang="ts">
import { FileCheck2, Lightbulb, MapPin } from "@lucide/vue";
import type { ProductOpportunityV1 } from "@logix/contracts";

defineProps<{ item: ProductOpportunityV1 }>();

const labels: Record<string, string> = {
  market_code: "市场",
  channel_code: "渠道",
  category_ref: "商品类别",
  observed_fact_summary: "观察事实",
  hypothesis: "经营假设",
  evidence_refs: "来源证据",
  opportunity_statement: "机会说明",
};
</script>

<template>
  <article class="opportunity-detail">
    <header>
      <small>经营团队交来了什么</small>
      <h2>{{ item.handoff.title }}</h2>
    </header>
    <dl class="scope">
      <div>
        <dt><MapPin :size="14" />市场</dt>
        <dd>{{ item.handoff.marketCode || "待补" }}</dd>
      </div>
      <div>
        <dt>渠道</dt>
        <dd>{{ item.handoff.channelCode || "待补" }}</dd>
      </div>
      <div>
        <dt>商品范围</dt>
        <dd>{{ item.handoff.categoryRef || "待补" }}</dd>
      </div>
    </dl>
    <section>
      <small>希望选品验证</small>
      <h3>机会说明</h3>
      <p>
        {{
          item.handoff.opportunityStatement || "机会说明待补，不影响先领取。"
        }}
      </p>
    </section>
    <div class="facts-grid">
      <section>
        <small>已观察事实</small>
        <p>{{ item.handoff.observedFactSummary || "待补" }}</p>
      </section>
      <section>
        <small>尚待验证</small>
        <p>
          <Lightbulb :size="16" />{{
            item.handoff.hypothesis || "经营假设待补"
          }}
        </p>
      </section>
    </div>
    <section class="evidence-summary">
      <FileCheck2 :size="18" />
      <span
        ><b>{{ item.handoff.evidenceRefs.length }} 项来源证据</b
        ><small
          >交接版本 {{ item.handoff.version }} ·
          {{ item.handoff.createdAt.slice(0, 10) }}</small
        ></span
      >
    </section>
    <section v-if="item.handoff.pendingFieldCodes.length" class="pending">
      <b>仍待补</b>
      <span v-for="code in item.handoff.pendingFieldCodes" :key="code">{{
        labels[code] || code
      }}</span>
      <small>这些内容随后会继续补充，不阻止领取和评估。</small>
    </section>
  </article>
</template>

<style scoped>
.opportunity-detail > header,
.opportunity-detail > section {
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}
header small,
section > small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
h2,
h3 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
}
h2 {
  font-size: var(--text-title);
}
h3 {
  font-size: var(--text-meta);
}
p {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}
.scope {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}
.scope div {
  padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--line);
}
.scope div:last-child {
  border-right: 0;
}
.scope dt {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
}
.scope dd {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-weight: 700;
}
.facts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--line);
}
.facts-grid section {
  padding: var(--space-4);
}
.facts-grid section + section {
  border-left: 1px solid var(--line);
  background: var(--info-bg);
}
.facts-grid p {
  display: flex;
  gap: var(--space-2);
}
.evidence-summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.evidence-summary svg {
  color: var(--ok);
}
.evidence-summary span {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.evidence-summary small {
  color: var(--muted);
  font-size: var(--text-micro);
}
.pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  background: var(--warn-bg);
}
.pending b {
  color: var(--warn);
}
.pending span {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--warn);
  border-radius: var(--radius-control);
  color: var(--warn);
  font-size: var(--text-micro);
}
.pending small {
  flex: 1 1 100%;
  color: var(--muted);
}
@media (max-width: 680px) {
  .scope,
  .facts-grid {
    grid-template-columns: 1fr;
  }
  .scope div,
  .facts-grid section + section {
    border-right: 0;
    border-left: 0;
    border-bottom: 1px solid var(--line);
  }
}
</style>
