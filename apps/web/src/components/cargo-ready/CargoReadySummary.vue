<script setup lang="ts">
import { ArrowRight, PackageCheck, ShieldCheck } from "@lucide/vue";
import { computed } from "vue";
import type { CargoReadyComplianceAssessment } from "../../api/cargoReadyCompliance";
import type { ContainerCargoScope } from "../../api/containers";
import type { LiveNodeView } from "../../data/liveNodeProjection";

const props = defineProps<{
  containerId: string;
  cargo: ContainerCargoScope | null;
  node: LiveNodeView | null;
  assessment: CargoReadyComplianceAssessment | null;
}>();

const DECISION_LABELS: Record<string, string> = {
  approved: "已放行",
  approved_with_conditions: "有条件放行",
  blocked: "已阻断",
  evidence_required: "待补证",
};

const decisionLabel = computed(() => {
  const code = props.assessment?.currentDecision?.decisionCode;
  if (!code) return "待决定";
  return DECISION_LABELS[code] ?? code;
});
</script>

<template>
  <div class="cargo-summary">
    <header class="panel-header">
      <span class="panel-icon" aria-hidden="true">
        <PackageCheck :size="18" />
      </span>
      <span>
        <small>备货事实</small>
        <h2>装载 SKU</h2>
      </span>
      <b>{{ cargo?.items.length ?? 0 }} 行</b>
    </header>

    <p v-if="!cargo" class="empty-state">装载数据不可用。</p>
    <p v-else-if="!cargo.items.length" class="empty-state">
      当前没有活动装载明细。
    </p>
    <div v-else class="cargo-table-wrap">
      <table>
        <thead>
          <tr>
            <th>产品货号</th>
            <th>装载数量</th>
            <th>SKU 身份</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in cargo.items" :key="item.replenishmentOrderLineId">
            <td class="mono">{{ item.productNumber }}</td>
            <td>{{ item.allocatedQuantity }} {{ item.quantityUnit }}</td>
            <td class="mono muted">{{ item.productSkuId }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="compliance-strip" aria-label="备货合规状态">
      <span class="panel-icon panel-icon--compliance" aria-hidden="true">
        <ShieldCheck :size="18" />
      </span>
      <span class="compliance-copy">
        <small>合规评审</small>
        <b v-if="assessment">{{ decisionLabel }}</b>
        <b v-else>尚未评审</b>
        <span v-if="assessment">
          {{ assessment.jurisdictionCountryCode }} · 发现
          {{ assessment.findings.length }} 项 · 版本 {{ assessment.version }}
        </span>
        <span v-else>需要建立当前装载与规则版本的评审快照</span>
      </span>
      <router-link
        :to="{ path: '/compliance', query: { containerId } }"
        aria-label="进入合规评审"
      >
        进入评审<ArrowRight :size="15" aria-hidden="true" />
      </router-link>
    </section>

    <footer class="node-foot">
      <span>备货节点</span>
      <b>{{ node?.stateLabel ?? "未初始化" }}</b>
      <time v-if="node?.completedAt">{{ node.completedAt }}</time>
    </footer>
  </div>
</template>

<style scoped>
.cargo-summary {
  min-width: 0;
}

.panel-header {
  min-height: 58px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-header > span:not(.panel-icon),
.compliance-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-header h2 {
  margin: 0;
  font-size: 16px;
}

.panel-header small,
.compliance-copy small,
.compliance-copy > span,
.node-foot span,
.node-foot time {
  color: var(--muted);
  font-size: 10px;
}

.panel-header > b {
  color: var(--brand-strong);
  font-size: 12px;
}

.panel-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.panel-icon--compliance {
  background: var(--ok-bg);
  color: var(--ok);
}

.empty-state {
  margin: 0;
  padding: 18px 12px;
  color: var(--muted);
  font-size: 12px;
}

.cargo-table-wrap {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  font-size: 12px;
  overflow-wrap: anywhere;
}

th {
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

th:nth-child(1) {
  width: 28%;
}

th:nth-child(2) {
  width: 25%;
}

.muted {
  color: var(--muted);
  font-size: 10px;
}

.compliance-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--line-strong);
}

.compliance-strip a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  color: var(--brand-strong);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.node-foot {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.node-foot time {
  margin-left: auto;
}

@media (max-width: 560px) {
  .compliance-strip {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .compliance-strip a {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
