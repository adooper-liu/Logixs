<script setup lang="ts">
import { Anchor, BadgeCheck, Clock3, Landmark, Truck } from "@lucide/vue";
import type { LifecycleDateFact } from "../../api/lifecycleDateFacts";
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  arrivalFact: LifecycleDateFact | null;
  customsFact: LifecycleDateFact | null;
  availableFact: LifecycleDateFact | null;
  gateOutFact: LifecycleDateFact | null;
  node: LiveNodeView | null;
}>();

function dateLabel(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : "尚未登记";
}

function locationLabel(fact: LifecycleDateFact | null): string {
  if (!fact?.location) return "地点待补";
  return (
    [fact.location.unlocode, fact.location.locationId]
      .filter(Boolean)
      .join(" · ") || "地点待补"
  );
}

function stateLabel(fact: LifecycleDateFact | null): string {
  if (!fact) return "待登记";
  return (
    {
      review_required: "待复核",
      pending_application: "待门禁",
      applied: "已采信",
      rejected: "已拒绝",
      not_applicable: "仅作参考",
    }[fact.applicationState] ?? fact.applicationState
  );
}

function reasonLabel(code: string): string {
  return (
    {
      LIFECYCLE_EVENT_PENDING_PREDECESSOR: "前序节点尚未完成",
      LIFECYCLE_EVENT_PENDING_NODE_BLOCK: "存在尚未解除的业务阻断",
      LIFECYCLE_EVENT_PENDING_TERMINAL_AVAILABILITY: "缺少已采信的码头可提事实",
      LIFECYCLE_EVENT_PENDING_PICKUP_LOCATION_CONTEXT:
        "可提或出场事实缺少可识别地点",
      LIFECYCLE_EVENT_PICKUP_LOCATION_MISMATCH: "可提地点与出场地点不一致",
      LIFECYCLE_EVENT_PICKUP_BEFORE_AVAILABLE: "出场时间早于码头可提时间",
    }[code] ?? code
  );
}
</script>

<template>
  <section class="facts-panel" aria-label="提柜事实总览">
    <header>
      <span><Truck :size="17" />提柜条件与事实</span>
      <b>{{ node?.stateLabel ?? "流程未初始化" }}</b>
    </header>
    <div class="milestones">
      <span
        ><Anchor :size="15" /><small>目的港实际到港</small
        ><b>{{ dateLabel(arrivalFact?.occurredAt) }}</b></span
      >
      <span
        ><Landmark :size="15" /><small>实际清关</small
        ><b>{{ dateLabel(customsFact?.occurredAt) }}</b></span
      >
      <span
        ><Clock3 :size="15" /><small>码头可提</small
        ><b>{{ dateLabel(availableFact?.occurredAt) }}</b
        ><em>{{ stateLabel(availableFact) }}</em></span
      >
      <span
        ><BadgeCheck :size="15" /><small>重柜 Gate Out</small
        ><b>{{ dateLabel(gateOutFact?.occurredAt) }}</b
        ><em>{{ stateLabel(gateOutFact) }}</em></span
      >
    </div>
    <div class="location">
      <span
        ><small>可提地点</small><b>{{ locationLabel(availableFact) }}</b></span
      >
      <span
        ><small>出场地点</small><b>{{ locationLabel(gateOutFact) }}</b></span
      >
    </div>
    <p v-if="gateOutFact?.applicationReasonCode" class="pending">
      当前缺口：{{ reasonLabel(gateOutFact.applicationReasonCode) }}
    </p>
    <p v-else-if="availableFact && !gateOutFact" class="pending">
      码头可提已登记，仍需实际 Gate Out 才能完成提柜。
    </p>
  </section>
</template>

<style scoped>
.facts-panel {
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
.milestones,
.location {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.milestones > span,
.location > span {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 11px 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
b {
  overflow-wrap: anywhere;
  font-size: 12px;
}
small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  .milestones,
  .location {
    grid-template-columns: 1fr;
  }
}
</style>
