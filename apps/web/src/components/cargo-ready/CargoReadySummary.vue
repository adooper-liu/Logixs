<script setup lang="ts">
import { ArrowRight, PackageCheck, ShieldCheck } from "@lucide/vue";
import { computed } from "vue";
import type { CargoReadyComplianceAssessment } from "../../api/cargoReadyCompliance";
import type { ContainerCargoScope } from "../../api/containers";
import type {
  CargoReadyReadinessState,
  CargoReadySkuReadiness,
} from "../../data/cargoReadyWorkbench";
import type { LiveNodeView } from "../../data/liveNodeProjection";

const props = defineProps<{
  containerId: string;
  cargo: ContainerCargoScope | null;
  node: LiveNodeView | null;
  assessment: CargoReadyComplianceAssessment | null;
  readiness: readonly CargoReadySkuReadiness[];
}>();

const DECISION_LABELS: Record<string, string> = {
  approved: "已放行",
  approved_with_conditions: "有条件放行",
  blocked: "已阻断",
  evidence_required: "待补证",
};

const decisionLabel = computed(() => {
  const code = props.assessment?.currentDecision?.decisionCode;
  if (!code) return props.assessment ? "待决定" : "尚未评审";
  return DECISION_LABELS[code] ?? "待复核";
});

const stateLabels: Record<CargoReadyReadinessState, string> = {
  ready: "齐备",
  attention: "待确认",
  missing: "有缺口",
  unreviewed: "未评审",
  not_required: "未要求",
};
</script>

<template>
  <div class="cargo-summary">
    <header class="panel-header">
      <span class="panel-icon" aria-hidden="true">
        <PackageCheck :size="18" />
      </span>
      <span>
        <small>当前装载与准备情况</small>
        <h2>SKU 齐备度</h2>
      </span>
      <b>{{ readiness.length }} 行</b>
    </header>

    <p v-if="!cargo" class="empty-state">装载数据暂时不可用。</p>
    <p v-else-if="!readiness.length" class="empty-state">
      当前没有活动装载明细，无法开始备货核对。
    </p>
    <div v-else class="readiness-list" aria-label="SKU 齐备清单">
      <article
        v-for="row in readiness"
        :key="row.item.replenishmentOrderLineId"
        class="readiness-row"
      >
        <header>
          <span>
            <b>{{ row.item.productNumber }}</b>
            <small>
              装载 {{ row.item.allocatedQuantity }} {{ row.item.quantityUnit }}
            </small>
          </span>
          <em :class="`state state--${row.overall}`">
            {{ stateLabels[row.overall] }}
          </em>
        </header>

        <div class="factor-grid" aria-label="监管要素">
          <div>
            <small>电池</small>
            <span :class="`state state--${row.battery.state}`">
              {{ row.battery.label }}
            </span>
          </div>
          <div>
            <small>危险品</small>
            <span :class="`state state--${row.dangerousGoods.state}`">
              {{ row.dangerousGoods.label }}
            </span>
          </div>
          <div>
            <small>制冷剂</small>
            <span :class="`state state--${row.refrigerant.state}`">
              {{ row.refrigerant.label }}
            </span>
          </div>
          <div>
            <small>检验</small>
            <span :class="`state state--${row.inspection.state}`">
              {{ row.inspection.label }}
            </span>
          </div>
          <div>
            <small>证书</small>
            <span :class="`state state--${row.certificates.state}`">
              {{ row.certificates.label }}
            </span>
          </div>
        </div>

        <section class="gap-band">
          <div>
            <small>当前缺口</small>
            <ul v-if="row.missingReasons.length">
              <li v-for="reason in row.missingReasons" :key="reason">
                {{ reason }}
              </li>
            </ul>
            <span v-else class="ready-copy">当前评审未发现缺口</span>
          </div>
          <div>
            <small>责任与下一步</small>
            <span>{{ row.responsibleRole }}</span>
            <b>{{ row.nextAction }}</b>
          </div>
        </section>
      </article>
    </div>

    <section class="compliance-strip" aria-label="备货合规状态">
      <span class="panel-icon panel-icon--compliance" aria-hidden="true">
        <ShieldCheck :size="18" />
      </span>
      <span class="compliance-copy">
        <small>本柜合规评审</small>
        <b>{{ decisionLabel }}</b>
        <span v-if="assessment">
          {{ assessment.jurisdictionCountryCode }} · 发现
          {{ assessment.findings.length }} 项 · 版本 {{ assessment.version }}
        </span>
        <span v-else>先完成评审，系统才能判断各 SKU 是否齐备</span>
      </span>
      <router-link
        :to="{ path: '/compliance', query: { containerId } }"
        aria-label="进入合规评审"
      >
        {{ assessment ? "处理合规缺口" : "发起合规评审" }}
        <ArrowRight :size="15" aria-hidden="true" />
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
  gap: 3px;
}
.panel-header h2 {
  margin: 0;
  font-size: 16px;
}
.panel-header small,
.compliance-copy small,
.compliance-copy > span,
.node-foot span,
.node-foot time,
.readiness-row small,
.gap-band small {
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
.readiness-list {
  display: grid;
}
.readiness-row {
  min-width: 0;
  border-bottom: 1px solid var(--line-strong);
}
.readiness-row > header {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
}
.readiness-row > header > span,
.factor-grid > div,
.gap-band > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.readiness-row > header b {
  overflow-wrap: anywhere;
  font-size: 12px;
}
.factor-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(74px, 1fr));
  gap: 8px;
  padding: 9px 12px;
}
.factor-grid > div {
  padding-right: 8px;
  border-right: 1px solid var(--line);
}
.factor-grid > div:last-child {
  padding-right: 0;
  border-right: 0;
}
.state {
  display: inline-flex;
  width: fit-content;
  padding: 3px 6px;
  border-radius: var(--radius-s);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}
.state--ready {
  background: var(--ok-bg);
  color: var(--ok);
}
.state--attention,
.state--unreviewed {
  background: var(--warn-bg);
  color: var(--warn);
}
.state--missing {
  background: var(--risk-bg);
  color: var(--risk);
}
.gap-band {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(160px, 0.85fr);
  gap: 14px;
  padding: 9px 12px;
  border-top: 1px dashed var(--line);
  background: var(--surface-2);
}
.gap-band ul {
  margin: 0;
  padding-left: 16px;
  color: var(--risk);
  font-size: 10px;
}
.gap-band span,
.gap-band b {
  overflow-wrap: anywhere;
  font-size: 10px;
}
.ready-copy {
  color: var(--ok);
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
  .factor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .factor-grid > div,
  .factor-grid > div:last-child {
    padding: 0;
    border-right: 0;
  }
  .gap-band {
    grid-template-columns: 1fr;
  }
  .compliance-strip {
    grid-template-columns: 34px minmax(0, 1fr);
  }
  .compliance-strip a {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
