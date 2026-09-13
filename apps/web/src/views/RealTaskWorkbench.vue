<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { listContainers, type ContainerSummary } from "../api/containers";
import {
  completeWorkOrder,
  listNodeTasks,
  type NodeTaskDetail,
} from "../api/nodeTasks";
import SubmissionProgress from "../components/task/SubmissionProgress.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import {
  canCompleteWorkOrder,
  COMPLETE_WORK_ORDER_LABEL,
  parseEvidenceInput,
  toCompleteSubmission,
  toFailedSubmission,
  toSendingSubmission,
} from "../data/completeReceiptContract";
import type { SubmissionView } from "../data/sample";

const route = useRoute();
const router = useRouter();

const containers = ref<ContainerSummary[]>([]);
const tasks = ref<NodeTaskDetail[]>([]);
const loading = ref(false);
const error = ref("");
const submittingId = ref("");
const evidenceByWorkOrder = ref<Record<string, string>>({});
const submissions = ref<Record<string, SubmissionView>>({});
const idempotencyKeys = ref<Record<string, string>>({});

const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);

onMounted(async () => {
  try {
    containers.value = (await listContainers()).items;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "加载货柜失败，请确认 API 已启动";
  }
});

watch(
  containerId,
  (id) => {
    void loadTasks(id);
  },
  { immediate: true },
);

async function loadTasks(id: string): Promise<void> {
  if (!id) {
    tasks.value = [];
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    tasks.value = (
      await listNodeTasks({ containerId: id, pageSize: 50 })
    ).items;
  } catch (cause) {
    tasks.value = [];
    error.value =
      cause instanceof Error
        ? cause.message
        : "加载任务失败，请确认 API 已启动";
  } finally {
    loading.value = false;
  }
}

function selectContainer(id: string): void {
  void router.replace({
    path: "/real-tasks",
    query: id ? { containerId: id } : {},
  });
}

function evidenceFor(workOrderId: string): string {
  return evidenceByWorkOrder.value[workOrderId] ?? "";
}

function setEvidence(workOrderId: string, value: string): void {
  evidenceByWorkOrder.value = {
    ...evidenceByWorkOrder.value,
    [workOrderId]: value,
  };
}

function nextIdempotencyKey(workOrderId: string, reuse: boolean): string {
  const existing = idempotencyKeys.value[workOrderId];
  if (reuse && existing) return existing;
  const key = crypto.randomUUID();
  idempotencyKeys.value = { ...idempotencyKeys.value, [workOrderId]: key };
  return key;
}

function rememberSubmission(
  workOrderId: string,
  submission: SubmissionView,
): void {
  submissions.value = { ...submissions.value, [workOrderId]: submission };
}

async function submitComplete(
  task: NodeTaskDetail,
  workOrderId: string,
  reuseKey: boolean,
): Promise<void> {
  submittingId.value = workOrderId;
  rememberSubmission(workOrderId, toSendingSubmission(task.id));
  const idempotencyKey = nextIdempotencyKey(workOrderId, reuseKey);
  try {
    const result = await completeWorkOrder(workOrderId, {
      evidenceRefs: parseEvidenceInput(evidenceFor(workOrderId)),
      idempotencyKey,
    });
    const submission = toCompleteSubmission({
      taskId: task.id,
      result,
      observedAt: new Date().toLocaleTimeString(),
    });
    rememberSubmission(workOrderId, submission);
    if (submission.stage === "committed") {
      const next = { ...idempotencyKeys.value };
      delete next[workOrderId];
      idempotencyKeys.value = next;
      await loadTasks(containerId.value);
    } else if (!submission.canRetry) {
      const next = { ...idempotencyKeys.value };
      delete next[workOrderId];
      idempotencyKeys.value = next;
    }
  } catch (cause) {
    rememberSubmission(
      workOrderId,
      toFailedSubmission({
        taskId: task.id,
        message: cause instanceof Error ? cause.message : "完成工单失败",
      }),
    );
  } finally {
    submittingId.value = "";
  }
}
</script>

<template>
  <div class="real-tasks-page page-frame">
    <PageHeader eyebrow="薄真实链路验证" title="真实任务（API 接线）" />

    <p class="hint">
      按货柜列出节点任务。完成工单后在动作旁显示三段回执；空闲不占位。装箱/出运/离港需要合格证据引用。
    </p>

    <label class="picker">
      货柜
      <select
        data-testid="container-select"
        :value="containerId"
        @change="selectContainer(($event.target as HTMLSelectElement).value)"
      >
        <option value="">选择货柜</option>
        <option v-for="item in containers" :key="item.id" :value="item.id">
          {{ item.orderNumber }} · {{ item.containerNumber ?? "无箱号" }}
        </option>
      </select>
    </label>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">加载失败：{{ error }}</p>
    <p v-else-if="!containerId" class="hint">先选择货柜再查看任务。</p>
    <p v-else-if="tasks.length === 0" class="hint">该货柜暂无节点任务</p>

    <article
      v-for="task in tasks"
      :key="task.id"
      class="task-card"
      :data-task-id="task.id"
    >
      <header class="task-head">
        <h3>{{ task.nodeCode }}</h3>
        <span class="mono">{{ task.state }}</span>
      </header>
      <p class="meta mono">{{ task.taskDefinitionKey }} · {{ task.id }}</p>

      <ul class="work-orders">
        <li
          v-for="workOrder in task.workOrders"
          :key="workOrder.id"
          class="work-order"
        >
          <div class="work-order-row">
            <div>
              <b>{{ workOrder.workOrderDefinitionKey }}</b>
              <span class="mono">{{ workOrder.state }}</span>
            </div>
            <button
              v-if="canCompleteWorkOrder(workOrder.state)"
              type="button"
              class="complete-button"
              :data-work-order-id="workOrder.id"
              :disabled="submittingId === workOrder.id"
              @click="submitComplete(task, workOrder.id, false)"
            >
              {{ COMPLETE_WORK_ORDER_LABEL }}
            </button>
          </div>
          <label v-if="canCompleteWorkOrder(workOrder.state)" class="evidence">
            证据引用
            <input
              :data-testid="`evidence-${workOrder.id}`"
              :value="evidenceFor(workOrder.id)"
              placeholder="可选，空格或逗号分隔 UUID"
              @input="
                setEvidence(
                  workOrder.id,
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </label>
          <SubmissionProgress
            v-if="submissions[workOrder.id]"
            data-testid="submission-progress"
            :submission="submissions[workOrder.id]!"
            :action-label="COMPLETE_WORK_ORDER_LABEL"
            @retry="submitComplete(task, workOrder.id, true)"
          />
        </li>
      </ul>
    </article>
  </div>
</template>

<style scoped>
.real-tasks-page {
  min-width: 0;
  min-height: 100%;
}
.hint {
  color: var(--app-text-secondary, #6b7280);
  padding: 8px 0;
}
.hint--error {
  color: var(--app-danger, #dc2626);
}
.picker,
.evidence {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 420px;
  margin: 8px 0 16px;
  color: var(--app-text-secondary, #6b7280);
  font-size: 13px;
}
.picker select,
.evidence input {
  padding: 8px 10px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 8px;
  background: var(--app-surface, #fff);
}
.task-card {
  margin: 16px 0;
  padding: 14px 16px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 12px;
  background: var(--app-surface, #fff);
}
.task-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.task-head h3 {
  margin: 0;
  font-size: 16px;
}
.meta {
  margin: 4px 0 12px;
  color: var(--app-text-secondary, #6b7280);
  font-size: 12px;
}
.work-orders {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.work-order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.work-order-row span {
  margin-left: 8px;
  color: var(--app-text-secondary, #6b7280);
  font-size: 12px;
}
.complete-button {
  padding: 6px 12px;
  border: 1px solid var(--app-brand, #2563eb);
  border-radius: 8px;
  background: var(--app-surface, #fff);
  color: var(--app-brand, #2563eb);
  font-weight: 700;
  cursor: pointer;
}
.complete-button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.evidence {
  margin: 8px 0;
}
.mono {
  font-family: var(--font-mono, ui-monospace, monospace);
}
</style>
