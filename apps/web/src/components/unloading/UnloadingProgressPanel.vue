<script setup lang="ts">
import type { ContainerUnloadingReport } from "@logix/contracts";
import { Boxes, CircleGauge } from "@lucide/vue";

defineProps<{ report: ContainerUnloadingReport | null }>();
const stateLabel = (state: string) =>
  (
    ({
      started: "已开始",
      partial: "部分卸货",
      completed: "卸柜完成",
    }) as Record<string, string>
  )[state] ?? state;
const unitLabel = (unit: string) =>
  (
    ({ piece: "件", carton: "箱", set: "套", pallet: "托" }) as Record<
      string,
      string
    >
  )[unit] ?? unit;
</script>

<template>
  <section class="progress" aria-label="卸货进度">
    <header>
      <span><CircleGauge :size="16" />卸货进度</span
      ><b>{{ report ? `v${report.version}` : "未登记" }}</b>
    </header>
    <p v-if="!report" class="empty">
      先登记卸货开始，后续每次部分报工都会追加新版本。
    </p>
    <template v-else>
      <div class="status">
        <b>{{ stateLabel(report.operationState) }}</b
        ><span>{{
          report.startedAt ? new Date(report.startedAt).toLocaleString() : ""
        }}</span>
      </div>
      <div class="metrics">
        <span
          ><small>计划</small
          ><b
            >{{ report.expectedQuantity }}
            {{ unitLabel(report.quantityUnit) }}</b
          ></span
        >
        <span
          ><small>已卸</small
          ><b
            >{{ report.unloadedQuantity }}
            {{ unitLabel(report.quantityUnit) }}</b
          ></span
        >
        <span
          ><small>剩余</small
          ><b
            >{{ report.remainingQuantity }}
            {{ unitLabel(report.quantityUnit) }}</b
          ></span
        >
        <span
          ><small>破损 / 短少</small
          ><b
            >{{ report.damagedQuantity }} / {{ report.shortageQuantity }}</b
          ></span
        >
      </div>
      <p class="seal">
        <Boxes :size="14" />封号核对：{{
          report.sealCheck === "matched" ? "一致" : "不一致"
        }}；异常{{ report.exceptionResolved ? "已处理" : "未处理" }}
      </p>
      <p v-if="report.exceptionNotes" class="notes">
        {{ report.exceptionNotes }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.progress {
  display: grid;
}
header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  font-size: var(--text-label);
}
header span,
.seal {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.status {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--line);
}
.status span,
small,
.empty {
  color: var(--muted);
  font-size: var(--text-micro);
}
.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.metrics span {
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
.seal,
.notes,
.empty {
  margin: 0;
  padding: var(--space-2) var(--space-3);
}
.notes {
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-micro);
}
@media (max-width: 520px) {
  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
