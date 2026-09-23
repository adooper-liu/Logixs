<script setup lang="ts">
import { Anchor, BadgeCheck, Ship, Weight } from "@lucide/vue";
import type { ContainerDispatchSnapshot } from "../../api/containerDispatch";
import type { ContainerStuffingSnapshot } from "../../api/containerStuffing";
import type { LifecycleDateFact } from "../../api/lifecycleDateFacts";
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  stuffing: ContainerStuffingSnapshot | null;
  dispatch: ContainerDispatchSnapshot | null;
  gateInFact: LifecycleDateFact | null;
  loadedFact: LifecycleDateFact | null;
  node: LiveNodeView | null;
}>();

function dateLabel(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : "尚未登记";
}
</script>

<template>
  <section class="snapshot" aria-label="出运事实总览">
    <header>
      <span><Ship :size="17" />出运交接</span>
      <b>{{ node?.stateLabel ?? "流程未初始化" }}</b>
    </header>
    <div v-if="!stuffing" class="blocker">
      缺少当前装箱记录，不能确认出运交接。
    </div>
    <div v-else class="baseline">
      <span
        ><b>{{ stuffing.containerNumber }}</b
        ><small>柜号</small></span
      >
      <span
        ><b>{{ stuffing.sealNumber }}</b
        ><small>封号</small></span
      >
      <span
        ><b>第 {{ stuffing.version }} 版</b><small>装箱基线</small></span
      >
      <span>
        <b>{{ stuffing.vgm ? `${stuffing.vgm.weight} KGM` : "缺少 VGM" }}</b>
        <small><Weight :size="12" />装船重量</small>
      </span>
    </div>
    <div v-if="dispatch" class="dispatch-grid">
      <span
        ><small>订舱号</small><b>{{ dispatch.bookingNumber }}</b></span
      >
      <span
        ><small>船司</small><b>{{ dispatch.carrierCode }}</b></span
      >
      <span
        ><small>船名 / 航次</small
        ><b>{{ dispatch.vesselName }} / {{ dispatch.voyageNumber }}</b></span
      >
      <span
        ><small>主提单 / 分提单</small
        ><b
          >{{ dispatch.masterBillNumber ?? "待补" }} /
          {{ dispatch.houseBillNumber ?? "待补" }}</b
        ></span
      >
      <span
        ><small>VGM 交接</small
        ><b class="ok"><BadgeCheck :size="13" />已接收</b></span
      >
      <span
        ><small>当前版本</small><b>第 {{ dispatch.version }} 版</b></span
      >
    </div>
    <p v-else-if="stuffing" class="empty">
      待确认订舱、船名航次和 VGM 承运交接。
    </p>
    <div class="milestones">
      <span
        ><Anchor :size="15" /><small>重柜进港</small
        ><b>{{ dateLabel(gateInFact?.occurredAt) }}</b></span
      >
      <span
        ><Ship :size="15" /><small>实际装船</small
        ><b>{{ dateLabel(loadedFact?.occurredAt) }}</b></span
      >
    </div>
  </section>
</template>

<style scoped>
.snapshot {
  display: grid;
}
header {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  font-size: var(--text-label);
}
header span,
.ok {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.baseline,
.dispatch-grid,
.milestones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.baseline {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid var(--line);
}
.baseline > span,
.dispatch-grid > span,
.milestones > span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-3);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.baseline b,
.dispatch-grid b,
.milestones b {
  overflow-wrap: anywhere;
  font-size: var(--text-label);
}
small {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
}
.ok {
  color: var(--ok);
}
.blocker,
.empty {
  margin: 0;
  padding: var(--space-4) var(--space-3);
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-label);
}
@media (max-width: 720px) {
  .baseline,
  .dispatch-grid,
  .milestones {
    grid-template-columns: 1fr;
  }
}
</style>
