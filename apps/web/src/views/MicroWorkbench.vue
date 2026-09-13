<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { listClientOperations } from "../api/clientOperations";
import { getContainer } from "../api/containers";
import { listLifecycleEvents } from "../api/lifecycleEvents";
import { listLifecycleNodes } from "../api/lifecycleNodes";
import { listNodeTasks } from "../api/nodeTasks";
import EventEvidenceTimeline from "../components/container/EventEvidenceTimeline.vue";
import LiveNodeRail from "../components/container/LiveNodeRail.vue";
import ObjectContextBar from "../components/container/ObjectContextBar.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { attachLatestSync } from "../data/clientOperationQueueContract";
import { toLiveEvent } from "../data/liveEventProjection";
import { toLiveNode, type LiveNodeView } from "../data/liveNodeProjection";
import {
  attachOpenTasks,
  toLiveContainer,
} from "../data/liveWorkspaceProjection";
import type { ContainerProjection, EventRow } from "../data/sample";

const route = useRoute();
const loading = ref(true);
const error = ref("");
const record = ref<ContainerProjection | null>(null);
const nodes = ref<LiveNodeView[]>([]);
const events = ref<EventRow[]>([]);

const containerRecordId = computed(() =>
  String(route.params.containerRecordId ?? "").trim(),
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  record.value = null;
  nodes.value = [];
  events.value = [];
  if (!containerRecordId.value) {
    loading.value = false;
    return;
  }
  try {
    let row = toLiveContainer(await getContainer(containerRecordId.value));
    const extras = await Promise.allSettled([
      listLifecycleNodes(containerRecordId.value),
      listLifecycleEvents(containerRecordId.value, { pageSize: 200 }),
      listNodeTasks({
        containerId: containerRecordId.value,
        pageSize: 200,
      }),
      listClientOperations({ pageSize: 200 }),
    ]);
    const nodePage = extras[0];
    const eventPage = extras[1];
    const taskPage = extras[2];
    const operationPage = extras[3];
    nodes.value =
      nodePage.status === "fulfilled"
        ? nodePage.value.nodes.map(toLiveNode)
        : [];
    events.value =
      eventPage.status === "fulfilled"
        ? eventPage.value.items.map(toLiveEvent)
        : [];
    if (taskPage.status === "fulfilled") {
      row = attachOpenTasks([row], taskPage.value.items)[0] ?? row;
    }
    if (operationPage.status === "fulfilled") {
      const hints =
        taskPage.status === "fulfilled"
          ? taskPage.value.items.flatMap((task) => {
              const containerId = task.containerId?.trim() ?? "";
              if (!containerId) return [];
              return [
                {
                  containerId,
                  taskId: task.id,
                  workOrderIds: task.workOrders.map((item) => item.id),
                },
              ];
            })
          : [];
      row = attachLatestSync([row], operationPage.value.items, hints)[0] ?? row;
    }
    record.value = row;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message !== "RESOURCE_NOT_FOUND") {
      error.value = "货柜没能加载";
    }
  } finally {
    loading.value = false;
  }
}

watch(
  containerRecordId,
  () => {
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <div class="workbench page-frame">
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>
    <template v-else-if="record">
      <PageHeader title="一柜一档" />
      <ObjectContextBar :record="record" />
      <LiveNodeRail v-if="nodes.length" :nodes="nodes" />
      <EventEvidenceTimeline v-if="events.length" :events="events" />
      <section class="next-step" aria-label="下一步">
        <p v-if="!nodes.length">这一柜还没有流程。</p>
        <p v-else-if="!events.length">这一柜还没有事件记录。</p>
        <router-link
          :to="{
            path: '/tasks',
            query: { containerId: record.containerRecordId },
          }"
        >
          去做这柜的任务
        </router-link>
      </section>
    </template>
    <section v-else class="not-found">
      <b>找不到这只货柜</b>
      <p class="mono">{{ containerRecordId }}</p>
      <router-link to="/containers">回干活</router-link>
    </section>
  </div>
</template>

<style scoped>
.workbench {
  min-height: 100%;
}

.hint,
.next-step,
.not-found {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.hint {
  color: var(--muted);
}

.hint--error {
  color: var(--risk);
}

.next-step {
  margin-top: 12px;
}

.next-step p,
.not-found p {
  margin: 0 0 12px;
  color: var(--muted);
}

.next-step a,
.not-found a {
  color: var(--brand);
  text-decoration: none;
}

.not-found {
  padding: 36px 16px;
  text-align: center;
}
</style>
