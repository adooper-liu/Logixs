<script setup lang="ts">
import { computed } from "vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

interface RailNodeView extends LiveNodeView {
  sequenceLabel: string;
  dateText: string;
  ariaLabel: string;
}

const props = withDefaults(
  defineProps<{
    nodes: readonly LiveNodeView[];
    selectedNodeId?: string;
    timeZone?: string;
  }>(),
  {
    selectedNodeId: "",
    timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);

const emit = defineEmits<{
  select: [nodeInstanceId: string];
}>();

type SummaryKind = "actual" | "estimated" | "planned" | "completed";

const KIND_LABEL: Record<SummaryKind, string> = {
  actual: "实际",
  estimated: "预计",
  planned: "计划",
  completed: "完成",
};

// 摘要层用一个字符标出这条日期属于哪一轨；三轨细账在展开卡里。
const KIND_MARK: Record<SummaryKind, string> = {
  actual: "实",
  estimated: "预",
  planned: "计",
  completed: "完",
};

// 摘要取值优先级：实际 > 预计 > 计划 > 完成时间。
// completedAt 兜底是因为老数据的节点可能有完成时间却没有对应的 actual 事实。
function pickSummary(node: LiveNodeView): {
  kind: SummaryKind;
  value: string;
} | null {
  if (node.times.actualAt)
    return { kind: "actual", value: node.times.actualAt };
  if (node.times.estimatedAt)
    return { kind: "estimated", value: node.times.estimatedAt };
  if (node.times.plannedAt)
    return { kind: "planned", value: node.times.plannedAt };
  if (node.completedAt) return { kind: "completed", value: node.completedAt };
  return null;
}

function formatDate(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone,
  })
    .format(date)
    .replace(/\//g, "-");
}

const railNodes = computed<readonly RailNodeView[]>(() =>
  props.nodes.map((node) => {
    const sequenceLabel = String(node.sequence).padStart(2, "0");
    const summary = node.isNotApplicable ? null : pickSummary(node);
    const blockedText =
      node.blockedCount > 0 ? `，有 ${node.blockedCount} 项未关闭阻塞` : "";

    // 视觉层保持极简，完整信息放进 aria-label 与 title，供读屏与悬停。
    const timingText = node.isNotApplicable
      ? "不适用"
      : summary
        ? `${KIND_LABEL[summary.kind]} ${formatDate(summary.value, props.timeZone)}`
        : "时间待补";

    return {
      ...node,
      sequenceLabel,
      dateText: node.isNotApplicable
        ? "不适用"
        : summary
          ? `${KIND_MARK[summary.kind]}${formatDate(summary.value, props.timeZone)}`
          : "—",
      ariaLabel: `${sequenceLabel} ${node.name}，${node.stateLabel}，${timingText}${blockedText}`,
    };
  }),
);
</script>

<template>
  <nav class="rail" aria-label="货柜生命周期节点">
    <ol class="rail-track">
      <li
        v-for="node in railNodes"
        :key="node.nodeInstanceId"
        class="rail-item"
        :class="{
          'is-done': node.completedAt !== null,
          'is-current': node.isCurrent,
          'is-blocked': node.blockedCount > 0,
          'is-na': node.isNotApplicable,
          'is-selected': node.nodeInstanceId === selectedNodeId,
        }"
      >
        <button
          type="button"
          class="rail-node"
          :aria-current="node.isCurrent ? 'step' : undefined"
          :aria-label="node.ariaLabel"
          :title="node.ariaLabel"
          data-testid="rail-node"
          @click="emit('select', node.nodeInstanceId)"
        >
          <span class="sequence">{{ node.sequenceLabel }}</span>
          <span class="dot" aria-hidden="true" />
          <span class="name">{{ node.name }}</span>
          <span class="date">{{ node.dateText }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.rail {
  min-width: 0;
  margin: 0 0 12px;
  padding: 12px 14px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.rail-track {
  display: flex;
  align-items: flex-start;
  min-width: 700px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rail-item {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}

/* 连续主线：每站自画一段、首尾各收一半，14 站连成一条不断的线。
   纵向位置 = 序号行高 14 + 间距 4 + 点高一半 8，正好落在状态点的垂直中心。 */
.rail-item::before {
  position: absolute;
  top: 25px;
  right: 0;
  left: 0;
  height: 2px;
  background: var(--line-strong);
  content: "";
}

.rail-item:first-child::before {
  left: 50%;
}

.rail-item:last-child::before {
  right: 50%;
}

/* 已走过的段用完成色；不适用段改虚线；未发生段保持中性灰 */
.rail-item.is-done::before {
  background: var(--ok);
}

.rail-item.is-na::before {
  height: 0;
  border-top: 2px dashed var(--line-strong);
  background: transparent;
}

.rail-node {
  position: relative;
  z-index: 1;
  width: 100%;
  display: grid;
  grid-template-rows: 14px 16px auto auto;
  gap: 4px;
  justify-items: center;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: 0;
  text-align: center;
  cursor: pointer;
}

.rail-node:focus-visible {
  outline: 3px solid var(--brand);
  outline-offset: 3px;
  border-radius: var(--radius-s);
}

.sequence {
  color: var(--muted);
  font-size: 10px;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
}

/* 状态点：四态互不混同 —— 已完成实心 / 当前粗环 / 未发生空心中性 / 不适用虚线 */
.dot {
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
}

.rail-item.is-done .dot {
  border-color: var(--ok);
  background: var(--ok);
}

.rail-item.is-current .dot {
  border-width: 4px;
  border-color: var(--brand);
  background: var(--surface);
}

.rail-item.is-blocked .dot {
  border-color: var(--risk);
}

.rail-item.is-na .dot {
  border-style: dashed;
  background: transparent;
}

.rail-node:hover .dot {
  border-color: var(--brand);
}

.name {
  max-width: 100%;
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.date {
  color: var(--muted);
  font-size: 10px;
  line-height: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rail-item.is-na .name,
.rail-item.is-na .date {
  color: var(--muted);
}

/* 标记展开卡当前对应的站点，与 spec §4.1.1 的 ▲ 一致 */
.rail-item.is-selected .name {
  font-weight: 700;
}

.rail-item.is-selected::after {
  position: absolute;
  top: 60px;
  left: 50%;
  width: 0;
  height: 0;
  transform: translateX(-50%);
  border-right: 4px solid transparent;
  border-bottom: 5px solid var(--brand);
  border-left: 4px solid transparent;
  content: "";
}
</style>
