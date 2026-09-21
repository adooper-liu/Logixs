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
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
}
header span,
.seal {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.status span,
small,
.empty {
  color: var(--muted);
  font-size: 10px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.metrics span {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
b {
  overflow-wrap: anywhere;
  font-size: 12px;
}
.seal,
.notes,
.empty {
  margin: 0;
  padding: 9px 12px;
}
.notes {
  background: var(--warn-bg);
  color: var(--warn);
  font-size: 11px;
}
@media (max-width: 520px) {
  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
