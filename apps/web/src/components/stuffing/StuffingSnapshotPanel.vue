<script setup lang="ts">
import { ClipboardCheck, PackageOpen, Scale } from "@lucide/vue";
import { computed, ref } from "vue";
import type { ContainerStuffingSnapshot } from "../../api/containerStuffing";
import type { ContainerCargoScope } from "../../api/containers";
import type { LiveNodeView } from "../../data/liveNodeProjection";

const props = defineProps<{
  cargo: ContainerCargoScope | null;
  snapshot: ContainerStuffingSnapshot | null;
  node: LiveNodeView | null;
  historicalMode?: boolean;
}>();

const showHistoricalLines = ref(false);
const showCargoLines = computed(
  () => !props.historicalMode || showHistoricalLines.value,
);
const sourceLabel = computed(() => {
  if (!props.snapshot) return "未记录";
  return `${props.snapshot.sourceSystem} · ${props.snapshot.ingestionChannel}`;
});
const snapshotCurrent = computed(
  () =>
    Boolean(props.cargo?.allocationSetId) &&
    props.snapshot?.allocationSetId === props.cargo?.allocationSetId &&
    props.snapshot?.allocationSetVersion === props.cargo?.allocationSetVersion,
);
const readinessLabel = computed(() => {
  if (!props.cargo?.allocationSetId) return "等待装载明细";
  if (!props.snapshot) return "待记录装箱结果";
  if (!snapshotCurrent.value) return "装载已变化，需重做快照";
  return props.historicalMode ? "快照与当前装载一致" : "装箱记录齐备";
});
</script>

<template>
  <div class="snapshot-panel">
    <header class="panel-header">
      <span class="panel-icon"><PackageOpen :size="18" /></span>
      <span
        ><small>当前装载与装箱结果</small>
        <h2>装箱核对</h2></span
      >
      <em :class="{ ready: snapshotCurrent && !historicalMode }">{{
        readinessLabel
      }}</em>
    </header>

    <p v-if="historicalMode" class="historical-note">
      历史只读事实 · 来源：{{
        sourceLabel
      }}；未创建装箱工单，保存时间不代表实际装箱时间，也未形成 VGM
      或生命周期结论。
    </p>

    <section class="allocation-strip">
      <div>
        <small>装载版本</small
        ><b>{{ cargo?.allocationSetVersion ?? "未形成" }}</b>
      </div>
      <div>
        <small>SKU 行数</small><b>{{ cargo?.items.length ?? 0 }}</b>
      </div>
      <div>
        <small>装箱版本</small><b>{{ snapshot?.version ?? "未保存" }}</b>
      </div>
      <div>
        <small>证据数量</small><b>{{ snapshot?.evidenceRefs.length ?? 0 }}</b>
      </div>
    </section>

    <details v-if="historicalMode && snapshot" class="evidence-summary">
      <summary>查看来源摘要</summary>
      <dl>
        <div>
          <dt>来源</dt>
          <dd>{{ sourceLabel }}</dd>
        </div>
        <div>
          <dt>证据引用</dt>
          <dd>{{ snapshot.evidenceRefs.length }} 项</dd>
        </div>
        <div>
          <dt>用途</dt>
          <dd>追溯本柜历史装载关系</dd>
        </div>
      </dl>
    </details>

    <p v-if="!cargo?.items.length" class="empty-state">
      当前没有活动装载明细，不能确认本柜装箱范围。
    </p>
    <button
      v-else-if="historicalMode"
      type="button"
      class="cargo-disclosure"
      aria-controls="historical-cargo-lines"
      :aria-expanded="showHistoricalLines"
      @click="showHistoricalLines = !showHistoricalLines"
    >
      {{ cargo.items.length }} 个 SKU 明细
      <span>{{ showHistoricalLines ? "收起" : "展开核对" }}</span>
    </button>
    <div
      v-if="cargo?.items.length && showCargoLines"
      id="historical-cargo-lines"
      class="cargo-table"
      role="table"
      aria-label="本柜 SKU 装载明细"
    >
      <div class="table-row table-head" role="row">
        <span role="columnheader">产品货号</span>
        <span role="columnheader">本柜数量</span>
      </div>
      <div
        v-for="item in cargo.items"
        :key="item.replenishmentOrderLineId"
        class="table-row"
        role="row"
      >
        <b role="cell">{{ item.productNumber }}</b>
        <span role="cell"
          >{{ item.allocatedQuantity }} {{ item.quantityUnit }}</span
        >
      </div>
    </div>

    <section v-if="snapshot" class="fact-grid" aria-label="当前装箱记录">
      <div>
        <small>集装箱号</small><b>{{ snapshot.containerNumber }}</b>
      </div>
      <div>
        <small>封号</small><b>{{ snapshot.sealNumber }}</b>
      </div>
      <div>
        <small>包装数</small><b>{{ snapshot.packageCount }}</b>
      </div>
      <div>
        <small>毛重</small
        ><b><Scale :size="13" />{{ snapshot.grossWeight }} kg</b>
      </div>
      <div>
        <small>净重</small
        ><b>{{ snapshot.netWeight ? `${snapshot.netWeight} kg` : "未记录" }}</b>
      </div>
      <div>
        <small>体积</small><b>{{ snapshot.volume }} m³</b>
      </div>
      <div>
        <small>VGM</small
        ><b>{{ snapshot.vgm ? `${snapshot.vgm.weight} kg` : "本版未记录" }}</b>
      </div>
      <div>
        <small>保存时间</small
        ><b>{{ new Date(snapshot.createdAt).toLocaleString() }}</b>
      </div>
    </section>
    <p v-else class="snapshot-missing">
      <ClipboardCheck :size="16" />先在右侧录入装箱结果和证据。
    </p>

    <footer class="node-foot">
      <span>装箱节点</span
      ><b>{{
        historicalMode ? "未建立生命周期结论" : (node?.stateLabel ?? "未初始化")
      }}</b>
      <time v-if="node?.completedAt">{{ node.completedAt }}</time>
    </footer>
  </div>
</template>

<style scoped>
.snapshot-panel {
  min-width: 0;
}
.panel-header {
  min-height: 58px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}
.panel-header > span:not(.panel-icon) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.panel-header h2 {
  margin: 0;
  font-size: var(--text-title);
}
.panel-header small,
.allocation-strip small,
.fact-grid small,
.node-foot span,
.node-foot time {
  color: var(--muted);
  font-size: var(--text-micro);
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
.panel-header em {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-s);
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-micro);
  font-style: normal;
  font-weight: 700;
}
.panel-header em.ready {
  background: var(--ok-bg);
  color: var(--ok);
}
.allocation-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(80px, 1fr));
  border-bottom: 1px solid var(--line);
}
.allocation-strip > div,
.fact-grid > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-right: 1px solid var(--line);
}
.allocation-strip > div:last-child {
  border-right: 0;
}
.allocation-strip b,
.fact-grid b {
  overflow-wrap: anywhere;
  font-size: var(--text-micro);
}
.evidence-summary {
  border-bottom: 1px solid var(--line);
}
.evidence-summary summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 700;
  cursor: pointer;
}
.evidence-summary dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--line);
}
.evidence-summary dl div {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.evidence-summary dt {
  color: var(--muted);
  font-size: var(--text-micro);
}
.evidence-summary dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-label);
  font-weight: 600;
}
.cargo-disclosure {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.cargo-disclosure span {
  color: var(--brand-strong);
  font-size: var(--text-micro);
}
.cargo-table {
  border-bottom: 1px solid var(--line-strong);
}
.table-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.3fr) minmax(100px, 0.7fr);
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--line);
  font-size: var(--text-micro);
}
.table-row:first-child {
  border-top: 0;
}
.table-head {
  background: var(--surface-2);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}
.fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.fact-grid > div {
  border-bottom: 1px solid var(--line);
}
.fact-grid b {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.historical-note {
  margin: 0;
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--info-bg);
  color: var(--info);
  font-size: var(--text-label);
}
.empty-state,
.snapshot-missing {
  margin: 0;
  padding: var(--space-4) var(--space-3);
  color: var(--muted);
  font-size: var(--text-label);
}
.snapshot-missing {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--warn-bg);
  color: var(--warn);
}
.node-foot {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
}
.node-foot time {
  margin-left: auto;
}
@media (max-width: 560px) {
  .allocation-strip,
  .fact-grid,
  .evidence-summary dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .panel-header {
    grid-template-columns: 34px minmax(0, 1fr);
  }
  .panel-header em {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
