<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Bot } from "@lucide/vue";
import { useRoute } from "vue-router";
import { listClientOperations } from "../api/clientOperations";
import { getContainer } from "../api/containers";
import { listLifecycleEvents } from "../api/lifecycleEvents";
import { listLifecycleNodes } from "../api/lifecycleNodes";
import { listNodeTasks } from "../api/nodeTasks";
import EventEvidenceTimeline from "../components/container/EventEvidenceTimeline.vue";
import OpsAssistantPanel from "../components/assistant/OpsAssistantPanel.vue";
import LiveNodeRail from "../components/container/LiveNodeRail.vue";
import NodeTimeTrackCard from "../components/container/NodeTimeTrackCard.vue";
import ObjectActivityPanel from "../components/container/ObjectActivityPanel.vue";
import ObjectContextBar from "../components/container/ObjectContextBar.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { attachLatestSync } from "../data/clientOperationQueueContract";
import { toLiveEvent } from "../data/liveEventProjection";
import { toLiveNode, type LiveNodeView } from "../data/liveNodeProjection";
import { uiCopy } from "../data/uiCopyCatalog";
import { useOpsAssistant } from "../composables/useOpsAssistant";
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
const selectedNodeId = ref("");
const {
  session: assistantSession,
  opening: assistantOpening,
  sending: assistantSending,
  error: assistantError,
  open: openAssistantSession,
  send: sendAssistantMessage,
  close: closeAssistant,
} = useOpsAssistant();

const containerRecordId = computed(() =>
  String(route.params.containerRecordId ?? "").trim(),
);
const blockedTotal = computed(() =>
  nodes.value.reduce((sum, node) => sum + node.blockedCount, 0),
);
const selectedNode = computed(
  () =>
    nodes.value.find((node) => node.nodeInstanceId === selectedNodeId.value) ??
    nodes.value.find((node) => node.isCurrent) ??
    nodes.value[0] ??
    null,
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
    selectedNodeId.value = "";
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

async function openAssistant(): Promise<void> {
  if (!record.value) return;
  await openAssistantSession({ containerId: record.value.containerRecordId });
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
      <div class="record-stack">
        <ObjectContextBar :record="record" />

        <section class="slot-band" aria-label="标记与异常">
          <span class="slot-item">
            <small>标记</small>
            <b>—</b>
          </span>
          <span class="slot-item">
            <small>异常</small>
            <b :class="{ risk: blockedTotal > 0 }">
              {{ blockedTotal > 0 ? blockedTotal : "—" }}
            </b>
          </span>
        </section>

        <LiveNodeRail
          v-if="nodes.length"
          :nodes="nodes"
          @select="selectedNodeId = $event"
        />
        <p v-else class="hint">{{ uiCopy.chrome.emptyFlow }}</p>

        <NodeTimeTrackCard :node="selectedNode" />
        <ObjectActivityPanel :container-id="record.containerRecordId" />

        <section class="assistant-entry" aria-label="运营助手">
          <button
            type="button"
            :disabled="assistantOpening"
            @click="openAssistant"
          >
            <Bot :size="16" aria-hidden="true" />
            询问助手
          </button>
          <p v-if="assistantError && !assistantSession" role="alert">
            {{ assistantError }}
          </p>
        </section>
        <OpsAssistantPanel
          v-if="assistantSession"
          :session="assistantSession"
          :sending="assistantSending"
          :error="assistantError"
          @send="sendAssistantMessage"
          @close="closeAssistant"
        />

        <EventEvidenceTimeline v-if="events.length" :events="events" />

        <section class="next-step" aria-label="下一步">
          <p v-if="!events.length">{{ uiCopy.chrome.emptyEvents }}</p>
          <router-link
            :to="{
              path: '/tasks',
              query: { containerId: record.containerRecordId },
            }"
          >
            去做这柜的任务
          </router-link>
        </section>
      </div>
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

.record-stack {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.record-stack > * {
  margin: 0;
}

.slot-band {
  min-height: 48px;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.slot-item {
  min-width: 120px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
}

.slot-item + .slot-item {
  border-left: 1px solid var(--line);
}

.slot-item small {
  color: var(--muted);
}

.slot-item b {
  font-variant-numeric: tabular-nums;
}

.slot-item .risk {
  color: var(--risk);
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
  min-width: 0;
}

.assistant-entry {
  display: flex;
  align-items: center;
  gap: 12px;
}

.assistant-entry button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.assistant-entry p {
  margin: 0;
  color: var(--risk);
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

@media (max-width: 520px) {
  .slot-band {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .slot-item {
    min-width: 0;
    padding: 8px 10px;
  }
}
</style>
