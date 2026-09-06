<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Container,
  Clock,
  TriangleAlert,
} from "@lucide/vue";
import DecisionQueue from "../components/management/DecisionQueue.vue";
import ManagementSignalStrip from "../components/management/ManagementSignalStrip.vue";
import OperationsAnalytics from "../components/management/OperationsAnalytics.vue";
import OperationsFlowMap from "../components/management/OperationsFlowMap.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useDemoOperationsStore } from "../composables/useDemoOperationsStore";
import {
  achievementCalendars,
  capabilityRows,
  feeRows,
  meetingDecisions,
  weeklyAchievementSummary,
  type Tone,
} from "../data/sample";

const { containers, exceptions } = useDemoOperationsStore();

const pendingSync = computed(
  () =>
    containers.value.filter(
      (row) => !["committed", "idle"].includes(row.syncStatus.code),
    ).length,
);
const riskContainers = computed(
  () => containers.value.filter((row) => row.tone === "risk").length,
);
const signals = computed(() => [
  {
    label: "在线货柜",
    value: `${containers.value.length} 柜`,
    helpText: "按货柜流转记录的当前生命周期事实汇总。",
    tone: "brand" as const,
    icon: Container,
    to: "/containers",
  },
  {
    label: "高风险货柜",
    value: `${riskContainers.value} 柜`,
    helpText: "存在高风险信号的货柜优先进入决策队列。",
    tone: "risk" as const,
    icon: TriangleAlert,
    to: "/containers?filter=risk",
  },
  {
    label: "周计划达成",
    value: weeklyAchievementSummary.rate,
    supportingText: `完成 ${weeklyAchievementSummary.completed} / 计划 ${weeklyAchievementSummary.planned}`,
    tone: "warn" as const,
    icon: ChartNoAxesCombined,
    to: "/meso?dimension=achievement",
  },
  {
    label: "待服务器确认",
    value: `${pendingSync.value} 项`,
    supportingText: pendingSync.value ? "尚未计入完成事实" : "全部已落账",
    tone: pendingSync.value ? ("warn" as const) : ("ok" as const),
    icon: Clock,
    to: "/tasks",
  },
]);

const firstRiskContainer = computed(
  () =>
    containers.value.find((row) => row.tone === "risk") ?? containers.value[0],
);
const constrainedResource = computed(
  () =>
    capabilityRows
      .filter((row) => row.warning)
      .sort(
        (left, right) =>
          right.assigned / right.capacity - left.assigned / left.capacity,
      )[0],
);
const exposedFee = computed(
  () => feeRows.find((row) => row.tone === "risk") ?? feeRows[0],
);

const decisionItems = computed(() => {
  const items = [];
  if (firstRiskContainer.value) {
    items.push({
      id: "customs-evidence",
      title: "清关资料缺失",
      context: `${firstRiskContainer.value.containerNumber} · ${firstRiskContainer.value.risk}`,
      metric: `${firstRiskContainer.value.freeDaysLeft ?? "?"} 天`,
      metricLabel: "免堆窗口",
      action: "查看证据",
      tone: "risk" as const,
      to: `/container/${firstRiskContainer.value.containerRecordId}`,
    });
  }
  if (constrainedResource.value) {
    items.push({
      id: constrainedResource.value.planId,
      title: `${constrainedResource.value.resource}接近上限`,
      context: `${constrainedResource.value.provider} · ${constrainedResource.value.assigned}/${constrainedResource.value.capacity}`,
      metric: `${Math.round((constrainedResource.value.assigned / constrainedResource.value.capacity) * 100)}%`,
      metricLabel: "资源负荷",
      action: "调整计划",
      tone: "warn" as const,
      to: "/meso?dimension=capacity",
    });
  }
  if (exposedFee.value) {
    const tone: Tone = exposedFee.value.tone === "risk" ? "risk" : "warn";
    items.push({
      id: exposedFee.value.feeId,
      title: `${exposedFee.value.type}账单待核`,
      context: `${exposedFee.value.amount} · ${exposedFee.value.authority}`,
      metric: exposedFee.value.amount,
      metricLabel: "待核金额",
      action: "核对依据",
      tone,
      to: "/meso?dimension=fees",
    });
  }
  return items;
});
</script>

<template>
  <div class="dashboard page-frame">
    <PageHeader eyebrow="管理驾驶舱" title="货柜运营态势">
      <template #actions>
        <router-link class="page-link" to="/containers">
          查看已出运货柜
          <ArrowRight :size="15" aria-hidden="true" />
        </router-link>
      </template>
    </PageHeader>

    <ManagementSignalStrip :items="signals" />

    <div class="operations-grid">
      <OperationsFlowMap :rows="containers" />
      <DecisionQueue :items="decisionItems" />
    </div>

    <OperationsAnalytics
      :achievement-calendars="achievementCalendars"
      :capabilities="capabilityRows"
      :fees="feeRows"
      :exceptions="exceptions"
      :decisions="meetingDecisions"
    />

    <p v-if="pendingSync" class="sync-notice" role="status">
      {{ pendingSync }} 个操作仍在等待服务器确认，未计入完成事实。
    </p>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
}

.operations-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 2.15fr) minmax(300px, 0.85fr);
  gap: 12px;
}

.sync-notice {
  margin: 0;
  padding: 8px 10px;
  border-left: 3px solid var(--warn);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 11px;
}

@media (max-width: 1180px) {
  .operations-grid {
    grid-template-columns: 1fr;
  }
}
</style>
