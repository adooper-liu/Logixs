<script setup lang="ts">
import { ArrowRight, CircleDot, ShieldAlert } from "@lucide/vue";
import { computed } from "vue";
import type { WorkNode } from "../../data/sample";
import type { DisplayFieldSet } from "../ui/displayFieldContract";
import DynamicFieldPanel from "../ui/DynamicFieldPanel.vue";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{
  node: WorkNode;
  fieldSet: DisplayFieldSet;
  nodeIndex: number;
  nodeCount: number;
  nextActionHint: string;
  linkedTaskId?: string;
}>();

const phaseView = computed(() => {
  if (props.node.attention === "risk") return { label: "需处理", tone: "risk" };
  if (props.node.attention === "warn" || props.node.attention === "current")
    return { label: "待处理", tone: "warn" };
  if (props.node.phase === "done") return { label: "已发生", tone: "ok" };
  if (props.node.phase === "skipped") return { label: "已跳过", tone: "muted" };
  if (props.node.phase === "optional")
    return { label: "可选节点", tone: "muted" };
  return { label: "待发生", tone: "muted" };
});

const nodeNumber = computed(() => String(props.nodeIndex).padStart(2, "0"));
</script>

<template>
  <section class="node-panel" aria-label="当前节点事实">
    <header class="node-header">
      <div class="node-position" data-testid="node-position">
        <span class="node-label">节点</span>
        <div class="node-count">
          <b>{{ nodeNumber }}</b
          ><span> / </span><small>{{ nodeCount }}</small>
        </div>
      </div>
      <div class="node-title">
        <span>当前工作节点</span>
        <h2>{{ node.name }}</h2>
      </div>
      <span class="phase" :class="phaseView.tone">
        <CircleDot :size="13" aria-hidden="true" />{{ phaseView.label }}
      </span>
      <InfoTooltip v-if="node.note" label="查看节点说明" :text="node.note" />
    </header>

    <DynamicFieldPanel
      class="node-facts"
      aria-label="节点关键事实"
      :field-set="fieldSet"
      :columns="3"
      :mobile-columns="3"
      variant="signal"
    />

    <div class="next-action" aria-label="当前下一步">
      <span class="action-icon" aria-hidden="true">
        <ShieldAlert v-if="node.attention === 'risk'" :size="17" />
        <ArrowRight v-else :size="17" />
      </span>
      <div class="action-copy">
        <span>下一步</span>
        <p>{{ nextActionHint }}</p>
      </div>
      <router-link v-if="linkedTaskId" :to="'/tasks?task=' + linkedTaskId">
        进入关联任务<ArrowRight :size="15" aria-hidden="true" />
      </router-link>
      <span v-else class="read-only">当前节点无可执行任务</span>
    </div>
  </section>
</template>

<style scoped>
.node-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-left: 4px solid var(--brand);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.node-header {
  min-height: 58px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.node-position {
  height: 40px;
  display: grid;
  grid-template-rows: 13px 1fr;
  align-items: end;
  column-gap: 3px;
  padding-right: 12px;
  border-right: 1px solid var(--line-strong);
}

.node-label {
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
}

.node-count {
  display: flex;
  align-items: baseline;
}

.node-position b {
  color: var(--brand-strong);
  font-size: 21px;
  line-height: 1;
}

.node-count > span,
.node-position small,
.node-title > span {
  color: var(--muted);
  font-size: 10px;
}

.node-title {
  min-width: 0;
}

.node-title h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.2;
}

.phase {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
}

.phase.ok {
  color: var(--ok);
}

.phase.warn {
  color: var(--warn);
}

.phase.risk {
  color: var(--risk);
}

.phase.muted {
  color: var(--muted);
}

.node-facts {
  padding: 12px;
}

.next-action {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  background: var(--brand-soft);
}

.action-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--surface);
  color: var(--brand-strong);
}

.action-copy {
  min-width: 0;
}

.action-copy span {
  color: var(--brand-strong);
  font-size: 10px;
  font-weight: 700;
}

.action-copy p {
  margin: 1px 0 0;
  color: var(--ink);
  font-size: 13px;
}

.next-action a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--brand-strong);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.read-only {
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 720px) {
  .node-header {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .node-header :deep(.info-tooltip) {
    display: none;
  }

  .node-facts {
    padding: 10px;
  }

  .next-action {
    grid-template-columns: 30px minmax(0, 1fr);
  }

  .next-action a,
  .read-only {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
