<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import LifecycleRail from "../components/container/LifecycleRail.vue";
import ObjectContextBar from "../components/container/ObjectContextBar.vue";
import DynamicFieldPanel from "../components/ui/DynamicFieldPanel.vue";
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
  record,
  (nextRecord) => {
    const nodes = nextRecord?.rail ?? [];
    activeKey.value =
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
          <section v-if="activeNode" class="node-summary">
            <header class="section-head">
              <div>
                <b>{{ activeNode.name }}</b
                ><span>节点事实</span>
              </div>
              <InfoTooltip
                v-if="activeNode.note"
                label="查看节点说明"
                :text="activeNode.note"
              />
            </header>

            <DynamicFieldPanel
              v-if="activeNodeFields"
              class="node-facts"
              :field-set="activeNodeFields"
              :columns="3"
              :mobile-columns="3"
            />

            <div class="next-action">
              <div>
                <span>下一步</span>
                <p>{{ record.nextActionHint }}</p>
              </div>
              <router-link
                v-if="linkedTaskId"
                :to="`/tasks?task=${linkedTaskId}`"
                >进入关联任务</router-link
              >
              <span v-else class="read-only">当前节点无可执行任务</span>
            </div>
          </section>

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

          <section v-if="record.timeline.length" class="time-evidence">
            <header class="section-head">
              <div><b>计划、预计与实际</b><span>时间证据</span></div>
              <InfoTooltip
                label="查看时间证据口径"
                text="计划、预计和实际时间分开记录，实际时间必须能追溯到来源证据。"
              />
            </header>
            <div class="event-table" role="table" aria-label="节点时间证据">
              <div class="event-row event-header" role="row">
                <span>事件</span><span>计划</span><span>预计</span
                ><span>实际</span><span>证据</span>
              </div>
              <div
                v-for="event in record.timeline"
                :key="event.eventRef ?? event.eventCode"
                class="event-row"
                role="row"
              >
                <b>{{ event.label }}</b>
                <span>{{ event.planned || "—" }}</span>
                <span>{{ event.estimated || "—" }}</span>
                <span>{{ event.actual || "待发生" }}</span>
                <span>{{ event.evidence || "待补" }}</span>
              </div>
            </div>
          </section>

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
.section-head,
.next-action {
  display: flex;
  align-items: center;
}
.section-head span,
.next-action span {
  color: var(--muted);
  font-size: 11px;
}
.next-action p {
  margin: 0;
  color: var(--ink-soft);
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
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}
.lifecycle-panel,
.node-summary,
.customs-detail,
.time-evidence,
.projection-note {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}
.lifecycle-panel,
.node-summary,
.customs-detail,
.time-evidence {
  padding: 10px;
}
.node-workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.node-facts {
  margin-top: 8px;
}

.next-action {
  justify-content: space-between;
  gap: 14px;
  margin-top: 8px;
  padding: 8px 10px;
  border-left: 3px solid var(--brand);
  background: var(--brand-soft);
}
.next-action a {
  flex: none;
  color: var(--brand-strong);
  font-weight: 700;
  text-decoration: none;
}
.read-only {
  flex: none;
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
.event-table {
  margin-top: 8px;
  min-width: 660px;
}
.time-evidence {
  overflow-x: auto;
}
.event-row {
  display: grid;
  grid-template-columns: 0.8fr repeat(3, 1fr) 1.3fr;
  gap: 10px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
}
.event-row:last-child {
  border-bottom: 0;
}
.event-row span {
  color: var(--ink-soft);
  font-size: 12px;
}
.event-header span {
  color: var(--muted);
  font-size: 10px;
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
  .next-action {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
