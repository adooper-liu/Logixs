<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import LifecycleRail from "../components/container/LifecycleRail.vue";
import ObjectContextBar from "../components/container/ObjectContextBar.vue";
import NodeFactPanel from "../components/container/NodeFactPanel.vue";
import EventEvidenceTimeline from "../components/container/EventEvidenceTimeline.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import InfoTooltip from "../components/ui/InfoTooltip.vue";
import { createDisplayFieldSet } from "../components/ui/displayFieldContract";
import type { WorkNode } from "../data/sample";
import { useDemoOperationsStore } from "../composables/useDemoOperationsStore";

const route = useRoute();
const store = useDemoOperationsStore();
const activeKey = shallowRef("");

const containerRecordId = computed(() =>
  String(route.params.containerRecordId ?? ""),
);
const record = computed(
  () => store.getContainer(containerRecordId.value) ?? null,
);
const activeNode = computed<WorkNode | undefined>(() => {
  const nodes = record.value?.rail ?? [];
  return nodes.find((node) => node.key === activeKey.value) ?? nodes[0];
});
const activeNodeFields = computed(() => {
  if (!record.value || !activeNode.value) return undefined;
  return createDisplayFieldSet(
    record.value.nodeDisplaySchema,
    activeNode.value,
  );
});
const activeNodeIndex = computed(() => {
  const nodes = record.value?.rail ?? [];
  const index = nodes.findIndex((node) => node.key === activeNode.value?.key);
  return index >= 0 ? index + 1 : 1;
});
const linkedTaskId = computed(() => {
  const taskId = activeNode.value?.taskId;
  if (!taskId) return undefined;
  return store.getTask(taskId)?.containerRecordId === containerRecordId.value
    ? taskId
    : undefined;
});

const selectNode = (node: WorkNode) => {
  activeKey.value = node.key;
};

watch(
  [record, () => route.query.node],
  ([nextRecord, nodeQuery]) => {
    const nodes = nextRecord?.rail ?? [];
    activeKey.value =
      nodes.find(
        (node) => typeof nodeQuery === "string" && node.key === nodeQuery,
      )?.key ??
      nodes.find(
        (node) => node.attention === "risk" || node.attention === "current",
      )?.key ??
      nodes.find((node) => node.isCurrentStatus)?.key ??
      nodes[0]?.key ??
      "";
  },
  { immediate: true },
);
</script>

<template>
  <div class="workbench page-frame">
    <template v-if="record">
      <PageHeader eyebrow="货柜全生命周期" title="一柜一档">
        <template #actions>
          <div
            v-if="record.markers.length"
            class="markers"
            aria-label="货柜标记"
          >
            <span v-for="marker in record.markers" :key="marker.key">{{
              marker.name
            }}</span>
          </div>
        </template>
      </PageHeader>

      <ObjectContextBar :record="record" />

      <div class="workspace-grid">
        <aside class="lifecycle-panel">
          <header class="section-head">
            <div><b>生命周期</b><span>实际节点</span></div>
            <InfoTooltip
              label="查看生命周期投影口径"
              text="节点由实际事件投影；计划、预计和任务关注项不会自动改写货柜事实。"
            />
          </header>
          <LifecycleRail
            :nodes="record.rail"
            :active-key="activeKey"
            @select="selectNode"
          />
        </aside>

        <main class="node-workspace">
          <NodeFactPanel
            v-if="activeNode && activeNodeFields"
            :node="activeNode"
            :field-set="activeNodeFields"
            :node-index="activeNodeIndex"
            :node-count="record.rail.length"
            :next-action-hint="record.nextActionHint"
            :linked-task-id="linkedTaskId"
          />

          <section
            v-if="activeNode?.key === 'customs' && record.checklist.length"
            class="customs-detail"
          >
            <header class="section-head">
              <div><b>清关检查</b><span>执行与达成</span></div>
              <InfoTooltip
                label="查看清关检查规则"
                text="优先展示未达成、冲突和需要行动的检查项。"
              />
            </header>
            <div class="check-list">
              <article
                v-for="item in record.checklist"
                :key="item.q"
                :class="item.state"
              >
                <div>
                  <b>{{ item.q }}</b
                  ><span>{{ item.answer }}</span>
                </div>
                <strong>{{ item.action }}</strong>
              </article>
            </div>
          </section>

          <EventEvidenceTimeline
            v-if="record.timeline.length"
            :events="record.timeline"
          />

          <p v-else class="projection-note">
            该记录尚无可展示的权威事件；节点只呈现计划与任务关注项。
          </p>
        </main>
      </div>
    </template>
    <section v-else class="not-found">
      <b>未找到货柜流转记录</b>
      <p class="mono">{{ containerRecordId }}</p>
      <router-link to="/containers">返回已出运货柜列表</router-link>
    </section>
  </div>
</template>

<style scoped>
.workbench {
  min-height: 100%;
}
.markers,
.section-head {
  display: flex;
  align-items: center;
}
.section-head span {
  color: var(--muted);
  font-size: 11px;
}
.markers {
  flex-wrap: wrap;
  gap: 6px;
}
.markers span {
  padding: 3px 7px;
  border: 1px solid var(--warn);
  border-radius: var(--radius-s);
  color: var(--warn);
  background: var(--warn-bg);
  font-size: 11px;
}
.workspace-grid {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.lifecycle-panel,
.customs-detail,
.projection-note {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}
.lifecycle-panel,
.customs-detail {
  padding: 10px;
}
.node-workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-head {
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--line);
}
.section-head div {
  min-width: 0;
  display: flex;
  align-items: baseline;
  flex-direction: row;
  gap: 7px;
}
.check-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 8px;
  background: var(--line);
  border: 1px solid var(--line);
}
.check-list article {
  min-width: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 8px;
  background: var(--surface);
}
.check-list article > div {
  display: flex;
  flex-direction: column;
}
.check-list span,
.check-list strong {
  font-size: 11px;
}
.check-list span {
  color: var(--muted);
}
.check-list .ok strong {
  color: var(--ok);
}
.check-list .warn strong {
  color: var(--warn);
}
.check-list .risk strong {
  color: var(--risk);
}
.projection-note {
  margin: 0;
  padding: 16px;
  color: var(--muted);
}
.not-found {
  padding: 36px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  text-align: center;
}
.not-found p {
  margin: 5px 0 12px;
  color: var(--muted);
}
.not-found a {
  color: var(--brand);
  text-decoration: none;
}
@media (max-width: 900px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .check-list {
    grid-template-columns: 1fr;
  }
}
</style>
