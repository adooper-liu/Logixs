<script setup lang="ts">
import type {
  ContainerUnloadingReport,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { BadgeCheck, CalendarClock, MapPin, PackageCheck } from "@lucide/vue";
import type { LifecycleDateFact } from "../../api/lifecycleDateFacts";
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  instruction: WarehouseDeliveryInstruction | null;
  report: ContainerUnloadingReport | null;
  deliveryFact: LifecycleDateFact | null;
  plannedFact: LifecycleDateFact | null;
  estimatedFact: LifecycleDateFact | null;
  actualFact: LifecycleDateFact | null;
  node: LiveNodeView | null;
}>();

function dateLabel(value: string | undefined | null): string {
  return value ? new Date(value).toLocaleString() : "尚未登记";
}
function stateLabel(fact: LifecycleDateFact | null): string {
  if (!fact) return "待登记";
  return (
    (
      {
        review_required: "待复核",
        pending_application: "待门禁",
        applied: "已采信",
        rejected: "已拒绝",
      } as Record<string, string>
    )[fact.applicationState] ?? fact.applicationState
  );
}
function reasonLabel(code: string): string {
  return (
    (
      {
        LIFECYCLE_EVENT_PENDING_PREDECESSOR: "送仓等前序节点尚未完成",
        LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION: "缺少当前目的仓指令",
        LIFECYCLE_EVENT_PENDING_UNLOADING_REPORT: "缺少卸柜作业记录",
        LIFECYCLE_EVENT_PENDING_UNLOADING_COMPLETION: "当前仍是开始或部分卸货",
        LIFECYCLE_EVENT_UNLOADING_WAREHOUSE_MISMATCH:
          "卸货仓库与当前目的仓不一致",
        LIFECYCLE_EVENT_UNLOADING_COMPLETION_TIME_MISMATCH:
          "完成时间与实际日期事实不一致",
        LIFECYCLE_EVENT_PENDING_UNLOADING_EVIDENCE:
          "缺少本次卸柜的合格仓方证据",
      } as Record<string, string>
    )[code] ?? code
  );
}
</script>

<template>
  <section class="facts" aria-label="卸柜事实总览">
    <header>
      <span><PackageCheck :size="17" />卸柜条件与事实</span
      ><b>{{ node?.stateLabel ?? "流程未初始化" }}</b>
    </header>
    <div class="facts-grid">
      <span
        ><MapPin :size="15" /><small>目的仓</small
        ><b>{{
          instruction
            ? `${instruction.warehouseCode ?? "未编码"} · ${instruction.warehouseName}`
            : "待锁定"
        }}</b></span
      >
      <span
        ><BadgeCheck :size="15" /><small>实际到仓</small
        ><b>{{ dateLabel(deliveryFact?.occurredAt) }}</b></span
      >
      <span
        ><CalendarClock :size="15" /><small>计划 / 预计卸柜</small
        ><b
          >{{ dateLabel(plannedFact?.occurredAt) }} /
          {{ dateLabel(estimatedFact?.occurredAt) }}</b
        ></span
      >
      <span
        ><PackageCheck :size="15" /><small>实际卸柜完成</small
        ><b>{{ dateLabel(actualFact?.occurredAt) }}</b
        ><em>{{ stateLabel(actualFact) }}</em></span
      >
    </div>
    <p v-if="actualFact?.applicationReasonCode" class="pending">
      当前缺口：{{ reasonLabel(actualFact.applicationReasonCode) }}
    </p>
    <p v-else-if="!instruction" class="pending">
      先在送仓工作台锁定本柜本次目的仓。
    </p>
    <p
      v-else-if="!deliveryFact || deliveryFact.applicationState !== 'applied'"
      class="pending"
    >
      等待实际送仓事实采信后，再确认仓库现场卸柜。
    </p>
    <p v-else-if="report?.operationState !== 'completed'" class="pending">
      到仓条件已具备；开始或部分卸货只更新进度，不会让货柜过站。
    </p>
  </section>
</template>

<style scoped>
.facts {
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
header span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.facts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.facts-grid > span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-3);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
b {
  overflow-wrap: anywhere;
  font-size: var(--text-label);
}
small {
  color: var(--muted);
  font-size: var(--text-micro);
}
em {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-style: normal;
}
.pending {
  margin: 0;
  padding: var(--space-3) var(--space-3);
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-micro);
  overflow-wrap: anywhere;
}
@media (max-width: 720px) {
  .facts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
