<script setup lang="ts">
import type { WarehouseDeliveryInstruction } from "@logix/contracts";
import {
  BadgeCheck,
  CalendarClock,
  LogOut,
  MapPin,
  Warehouse,
} from "@lucide/vue";
import type { LifecycleDateFact } from "../../api/lifecycleDateFacts";
import type { LiveNodeView } from "../../data/liveNodeProjection";

const props = defineProps<{
  instruction: WarehouseDeliveryInstruction | null;
  gateOutFact: LifecycleDateFact | null;
  plannedFact: LifecycleDateFact | null;
  estimatedFact: LifecycleDateFact | null;
  deliveredFact: LifecycleDateFact | null;
  warehouseArrivalFact: LifecycleDateFact | null;
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
        LIFECYCLE_EVENT_PENDING_PREDECESSOR: "前序节点尚未完成",
        LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION: "缺少当前目的仓指令",
        LIFECYCLE_EVENT_PENDING_DELIVERY_LOCATION_CONTEXT:
          "实际送仓缺少仓库地点",
        LIFECYCLE_EVENT_DELIVERY_LOCATION_MISMATCH: "实际地点与目的仓不一致",
        LIFECYCLE_EVENT_PENDING_DELIVERY_RECEIPT_EVIDENCE:
          "缺少合格 POD 或仓库签收证据",
        LIFECYCLE_EVENT_PENDING_WAREHOUSE_AUTHORITY_EVIDENCE:
          "缺少仓库、WMS 或门岗权威证据",
      } as Record<string, string>
    )[code] ?? code
  );
}
const currentActual = () => props.warehouseArrivalFact ?? props.deliveredFact;
</script>

<template>
  <section class="facts" aria-label="送仓事实总览">
    <header>
      <span><Warehouse :size="17" />送仓条件与事实</span
      ><b>{{ node?.stateLabel ?? "流程未初始化" }}</b>
    </header>
    <div class="facts-grid">
      <span
        ><LogOut :size="15" /><small>实际提柜</small
        ><b>{{ dateLabel(gateOutFact?.occurredAt) }}</b></span
      >
      <span
        ><MapPin :size="15" /><small>当前目的仓</small
        ><b>{{
          instruction
            ? `${instruction.warehouseCode ?? "未编码"} · ${instruction.warehouseName}`
            : "待锁定"
        }}</b></span
      >
      <span
        ><CalendarClock :size="15" /><small>计划 / 预计送仓</small
        ><b
          >{{ dateLabel(plannedFact?.occurredAt) }} /
          {{ dateLabel(estimatedFact?.occurredAt) }}</b
        ></span
      >
      <span
        ><BadgeCheck :size="15" /><small>实际送仓</small
        ><b>{{ dateLabel(currentActual()?.occurredAt) }}</b
        ><em>{{ stateLabel(currentActual()) }}</em></span
      >
    </div>
    <div v-if="instruction" class="instruction-line">
      <span
        ><small>仓库地点 ID</small
        ><b>{{ instruction.warehouseLocationId }}</b></span
      >
      <span
        ><small>预约窗口</small
        ><b
          >{{ dateLabel(instruction.appointmentStartAt) }} 至
          {{ dateLabel(instruction.appointmentEndAt) }}</b
        ></span
      >
      <span
        ><small>当地时区</small><b>{{ instruction.timezone }}</b></span
      >
    </div>
    <p v-if="currentActual()?.applicationReasonCode" class="pending">
      当前缺口：{{ reasonLabel(currentActual()!.applicationReasonCode!) }}
    </p>
    <p v-else-if="!instruction" class="pending">
      先锁定本柜本次目的仓，实际送仓事实才有可核对的目的地。
    </p>
    <p v-else-if="!currentActual()" class="pending">
      目的仓已锁定，仍需实际 POD 签收或仓库权威到场事实。
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
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  font-size: 12px;
}
header span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.facts-grid,
.instruction-line {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.facts-grid > span,
.instruction-line > span {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 11px 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.instruction-line {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
b {
  overflow-wrap: anywhere;
  font-size: 12px;
}
small {
  color: var(--muted);
  font-size: 10px;
}
em {
  color: var(--brand-strong);
  font-size: 10px;
  font-style: normal;
}
.pending {
  margin: 0;
  padding: 10px 12px;
  background: var(--warn-bg);
  color: var(--warn);
  font-size: 11px;
  overflow-wrap: anywhere;
}
@media (max-width: 720px) {
  .facts-grid,
  .instruction-line {
    grid-template-columns: 1fr;
  }
}
</style>
