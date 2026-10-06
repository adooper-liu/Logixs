<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { ChevronDown } from "@lucide/vue";
import type { ProductOpportunityV1 } from "@logix/contracts";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{ item: ProductOpportunityV1 }>();

const labels: Record<string, string> = {
  market_code: "市场",
  channel_code: "渠道",
  category_ref: "商品类别",
  observed_fact_summary: "观察事实",
  hypothesis: "经营假设",
  evidence_refs: "来源证据",
  opportunity_statement: "机会说明",
};

const snapshotOpen = shallowRef(false);

const supplemented = computed(
  () => new Set(props.item.supplementedFieldCodes ?? []),
);

const supplementedFactCount = computed(() => supplemented.value.size);
const pendingLabels = computed(() =>
  props.item.handoff.pendingFieldCodes
    .map((code) => labels[code] || code)
    .join("、"),
);
</script>

<template>
  <article class="opportunity-detail">
    <header>
      <h2>{{ item.handoff.title }}</h2>
    </header>
    <dl class="opportunity-facts">
      <div>
        <dt>经营范围</dt>
        <dd>
          {{ item.handoff.marketCode || "市场未记录" }} ·
          {{ item.handoff.channelCode || "渠道未记录" }} ·
          {{ item.handoff.categoryRef || "商品范围未记录" }}
        </dd>
      </div>
      <div>
        <dt>验证目标</dt>
        <dd>{{ item.handoff.opportunityStatement || "历史交接未记录" }}</dd>
      </div>
      <div>
        <dt>事实</dt>
        <dd>{{ item.handoff.observedFactSummary || "历史交接未记录" }}</dd>
      </div>
      <div>
        <dt>经营判断</dt>
        <dd>{{ item.handoff.hypothesis || "历史交接未记录" }}</dd>
      </div>
      <div>
        <dt>证据</dt>
        <dd>{{ item.handoff.evidenceRefs.length }} 项</dd>
      </div>
    </dl>
    <div class="opportunity-status">
      <span v-if="supplementedFactCount">
        含后补事实
        <InfoTooltip
          label="查看后补事实说明"
          text="交接后的信号事实已合并到本页；原交接快照保持不变。"
        />
      </span>
      <span v-if="item.handoff.pendingFieldCodes.length">
        交接缺失 {{ item.handoff.pendingFieldCodes.length }} 项
        <InfoTooltip
          label="查看交接缺失字段"
          :text="`交接快照未记录：${pendingLabels}。选品不在此处补录。`"
        />
      </span>
    </div>
    <section
      v-if="item.handoffSnapshot"
      class="snapshot"
      aria-label="交接当日原文"
    >
      <button
        type="button"
        class="snapshot-fold"
        :aria-expanded="snapshotOpen"
        @click="snapshotOpen = !snapshotOpen"
      >
        <span>交接当日原文（审计）</span>
        <ChevronDown :size="16" :class="{ open: snapshotOpen }" />
      </button>
      <dl v-if="snapshotOpen" class="snapshot-body">
        <div>
          <dt>市场</dt>
          <dd>{{ item.handoffSnapshot.marketCode || "（空）" }}</dd>
        </div>
        <div>
          <dt>渠道</dt>
          <dd>{{ item.handoffSnapshot.channelCode || "（空）" }}</dd>
        </div>
        <div>
          <dt>商品范围</dt>
          <dd>{{ item.handoffSnapshot.categoryRef || "（空）" }}</dd>
        </div>
        <div>
          <dt>观察事实</dt>
          <dd>{{ item.handoffSnapshot.observedFactSummary || "（空）" }}</dd>
        </div>
        <div>
          <dt>经营判断</dt>
          <dd>{{ item.handoffSnapshot.hypothesis || "（空）" }}</dd>
        </div>
        <div>
          <dt>来源证据</dt>
          <dd>{{ item.handoffSnapshot.evidenceRefs.length }} 项</dd>
        </div>
      </dl>
    </section>
  </article>
</template>

<style scoped>
.opportunity-detail > header,
.opportunity-detail > section,
.opportunity-facts,
.opportunity-status {
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}
h2 {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-title);
}
.opportunity-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
  margin: 0;
}
.opportunity-facts dt {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}
.opportunity-facts dd {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}
.opportunity-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  color: var(--muted);
  font-size: var(--text-micro);
}
.snapshot {
  background: var(--surface-2);
}
.snapshot-fold {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 600;
}
.snapshot-fold svg {
  color: var(--muted);
  transition: transform 0.15s ease;
}
.snapshot-fold svg.open {
  transform: rotate(180deg);
}
.snapshot-body {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
}
.snapshot-body div {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: var(--space-2);
}
.snapshot-body dt {
  color: var(--muted);
  font-size: var(--text-micro);
}
.snapshot-body dd {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}
@media (max-width: 680px) {
  .opportunity-facts {
    grid-template-columns: 1fr;
  }
}
</style>
