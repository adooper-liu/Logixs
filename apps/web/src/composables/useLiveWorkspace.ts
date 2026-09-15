import { computed, ref, shallowRef } from "vue";
import { useRoute } from "vue-router";
import {
  getContainer,
  listContainers,
  type ContainerSummary,
} from "../api/containers";
import { resolveCompleteEvidenceRefs } from "../api/evidence";
import {
  claimWorkOrder,
  completeWorkOrder,
  listNodeTasks,
  type NodeTaskDetail,
} from "../api/nodeTasks";
import {
  CLAIM_WORK_ORDER_ACTION,
  toClaimSubmission,
} from "../data/claimReceiptContract";
import {
  toCompleteSubmission,
  toFailedSubmission,
  toSendingSubmission,
} from "../data/completeReceiptContract";
import {
  parseClaimActionCode,
  parseCompleteActionCode,
  toLiveContainer,
  toLiveTask,
} from "../data/liveWorkspaceProjection";
import type {
  ContainerProjection,
  SubmissionView,
  TaskAction,
  TaskItem,
} from "../data/sample";
import { uiCopy } from "../data/uiCopyCatalog";

const idleSubmission = (taskId: string): SubmissionView => ({
  taskId,
  stage: "idle",
});

export function useLiveWorkspace() {
  const route = useRoute();
  const summaries = ref<ContainerSummary[]>([]);
  const details = ref<NodeTaskDetail[]>([]);
  const containers = ref<ContainerProjection[]>([]);
  const tasks = ref<TaskItem[]>([]);
  const submissions = ref<Record<string, SubmissionView>>({});
  const idempotencyKeys = ref<Record<string, string>>({});
  const loading = ref(true);
  const error = ref("");
  const loadingMore = ref(false);
  const moreError = ref("");
  const hasMore = ref(false);
  const nextCursor = ref<string | null>(null);
  const activeTaskId = shallowRef("");
  const submitting = ref(false);

  const containerIdFilter = computed(() =>
    String(route.query.containerId ?? "").trim(),
  );

  const activeTask = computed(
    () =>
      tasks.value.find((task) => task.taskId === activeTaskId.value) ??
      tasks.value[0],
  );
  const activeContainer = computed(() => {
    const task = activeTask.value;
    if (!task) return undefined;
    return containers.value.find(
      (item) => item.containerRecordId === task.containerRecordId,
    );
  });
  const activeSubmission = computed(() => {
    const taskId = activeTask.value?.taskId;
    if (!taskId) return idleSubmission("");
    return submissions.value[taskId] ?? idleSubmission(taskId);
  });
  const isSubmitting = computed(
    () =>
      submitting.value ||
      (["sending", "received", "accepted"].includes(
        activeSubmission.value.stage,
      ) &&
        !activeSubmission.value.canRetry),
  );
  const canSubmit = computed(() => {
    const task = activeTask.value;
    if (!task || isSubmitting.value) return false;
    if (["blocked", "completed"].includes(task.status)) return false;
    if (!task.actions.some((action) => action.intent === "complete")) {
      return false;
    }
    return task.evidenceRequirements
      .filter((item) => item.required)
      .every(
        (item) =>
          item.state === "verified" && Boolean(item.capturedValue?.trim()),
      );
  });

  const taskQuery = (cursor?: string | null) => ({
    pageSize: 200,
    ...(containerIdFilter.value
      ? { containerId: containerIdFilter.value }
      : {}),
    ...(cursor ? { cursor } : {}),
  });

  const rememberPage = (page: {
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
  }) => {
    nextCursor.value = page.pageInfo.nextCursor;
    hasMore.value = Boolean(
      page.pageInfo.hasNextPage && page.pageInfo.nextCursor,
    );
  };

  const rebuild = (
    nextSummaries: ContainerSummary[],
    nextDetails: NodeTaskDetail[],
  ) => {
    summaries.value = nextSummaries;
    details.value = nextDetails;
    const byId = new Map(nextSummaries.map((item) => [item.id, item]));
    containers.value = nextSummaries.map(toLiveContainer);
    tasks.value = nextDetails.flatMap((detail) => {
      const containerId = detail.containerId ?? "";
      if (!containerId) return [];
      const summary = byId.get(containerId);
      return [
        toLiveTask(
          detail,
          summary ?? {
            id: containerId,
            orderNumber: "",
            containerNumber: null,
          },
        ),
      ];
    });
    if (!tasks.value.some((task) => task.taskId === activeTaskId.value)) {
      activeTaskId.value = tasks.value[0]?.taskId ?? "";
    }
  };

  const reload = async () => {
    loading.value = true;
    error.value = "";
    moreError.value = "";
    hasMore.value = false;
    nextCursor.value = null;
    try {
      const [page, taskPage] = await Promise.all([
        listContainers({ pageSize: 200 }),
        listNodeTasks(taskQuery()),
      ]);
      const scoped = containerIdFilter.value
        ? page.items.filter((item) => item.id === containerIdFilter.value)
        : page.items;
      rebuild(scoped, taskPage.items);
      rememberPage(taskPage);
    } catch {
      error.value = "任务没能加载";
      rebuild([], []);
    } finally {
      loading.value = false;
    }
  };

  const loadMore = async () => {
    const cursor = nextCursor.value;
    if (!hasMore.value || !cursor || loadingMore.value || loading.value) {
      return;
    }
    loadingMore.value = true;
    moreError.value = "";
    try {
      const page = await listNodeTasks(taskQuery(cursor));
      const knownTaskIds = new Set(details.value.map((item) => item.id));
      const added = page.items.filter((item) => !knownTaskIds.has(item.id));
      const knownContainerIds = new Set(summaries.value.map((item) => item.id));
      const missing = [
        ...new Set(
          added
            .map((item) => item.containerId?.trim() ?? "")
            .filter((id) => id && !knownContainerIds.has(id)),
        ),
      ];
      const extras = await Promise.allSettled(
        missing.map((id) => getContainer(id)),
      );
      const nextSummaries = [...summaries.value];
      for (const extra of extras) {
        if (extra.status === "fulfilled") nextSummaries.push(extra.value);
      }
      rebuild(nextSummaries, [...details.value, ...added]);
      rememberPage(page);
    } catch {
      moreError.value = "后面的任务没能加载";
    } finally {
      loadingMore.value = false;
    }
  };

  const selectTask = (taskId: string) => {
    if (isSubmitting.value) return;
    if (tasks.value.some((task) => task.taskId === taskId)) {
      activeTaskId.value = taskId;
    }
  };

  const canExecuteAction = (action: TaskAction) => {
    if (isSubmitting.value) return false;
    if (["blocked", "completed"].includes(activeTask.value?.status ?? "")) {
      return false;
    }
    if (action.intent === "claim") return true;
    return action.intent === "complete" && canSubmit.value;
  };

  const nextIdempotencyKey = (workOrderId: string, reuse: boolean) => {
    const existing = idempotencyKeys.value[workOrderId];
    if (reuse && existing) return existing;
    const key = crypto.randomUUID();
    idempotencyKeys.value = { ...idempotencyKeys.value, [workOrderId]: key };
    return key;
  };

  const executeAction = async (actionCode: string) => {
    const task = activeTask.value;
    const action = task?.actions.find((item) => item.actionCode === actionCode);
    if (!task || !action || !canExecuteAction(action)) return;
    const claimId = parseClaimActionCode(actionCode);
    const completeId = parseCompleteActionCode(actionCode);
    const workOrderId = claimId ?? completeId;
    if (!workOrderId) return;
    const reuse = Boolean(submissions.value[task.taskId]?.canRetry);
    submitting.value = true;
    submissions.value = {
      ...submissions.value,
      [task.taskId]: toSendingSubmission(
        task.taskId,
        claimId ? CLAIM_WORK_ORDER_ACTION : undefined,
      ),
    };
    try {
      if (claimId) {
        const result = await claimWorkOrder(claimId, {
          idempotencyKey: nextIdempotencyKey(claimId, reuse),
        });
        const submission = toClaimSubmission({
          taskId: task.taskId,
          result,
          observedAt: new Date().toLocaleTimeString(),
        });
        submissions.value = { ...submissions.value, [task.taskId]: submission };
        if (submission.stage === "committed" || !submission.canRetry) {
          const next = { ...idempotencyKeys.value };
          delete next[claimId];
          idempotencyKeys.value = next;
        }
        if (submission.stage === "committed") await reload();
        return;
      }
      const evidence = task.evidenceRequirements[0]?.capturedValue ?? "";
      const evidenceRefs = await resolveCompleteEvidenceRefs({
        nodeCode: task.nodeKey,
        containerId: task.containerRecordId,
        raw: evidence,
      });
      const result = await completeWorkOrder(workOrderId, {
        evidenceRefs,
        idempotencyKey: nextIdempotencyKey(workOrderId, reuse),
      });
      const submission = toCompleteSubmission({
        taskId: task.taskId,
        result,
        observedAt: new Date().toLocaleTimeString(),
      });
      submissions.value = { ...submissions.value, [task.taskId]: submission };
      if (submission.stage === "committed" || !submission.canRetry) {
        const next = { ...idempotencyKeys.value };
        delete next[workOrderId];
        idempotencyKeys.value = next;
      }
      if (submission.stage === "committed") await reload();
    } catch (cause) {
      submissions.value = {
        ...submissions.value,
        [task.taskId]: toFailedSubmission({
          taskId: task.taskId,
          message:
            cause instanceof Error
              ? cause.message
              : claimId
                ? uiCopy.chrome.claimFailed
                : uiCopy.chrome.completeFailed,
          actionCode: claimId ? CLAIM_WORK_ORDER_ACTION : undefined,
        }),
      };
    } finally {
      submitting.value = false;
    }
  };

  const retrySubmission = () => {
    const submission = activeSubmission.value;
    if (!submission.canRetry || !submission.actionCode) return;
    void executeAction(submission.actionCode);
  };

  const verifyEvidence = (_evidenceId: string, value?: string) => {
    const task = activeTask.value;
    if (!task) return;
    const next = tasks.value.map((item) => {
      if (item.taskId !== task.taskId) return item;
      return {
        ...item,
        evidenceRequirements: item.evidenceRequirements.map((evidence) => ({
          ...evidence,
          capturedValue: value,
          state: value?.trim() ? ("verified" as const) : ("pending" as const),
        })),
      };
    });
    tasks.value = next;
  };

  return {
    containers,
    tasks,
    exceptions: computed(() => []),
    activeTaskId,
    activeTask,
    activeContainer,
    activeSubmission,
    canSubmit,
    isSubmitting,
    loading,
    loadingMore,
    moreError,
    hasMore,
    error,
    canExecuteAction,
    selectTask,
    claimTask: () => {
      const action = activeTask.value?.actions.find(
        (item) => item.intent === "claim",
      );
      if (action) void executeAction(action.actionCode);
    },
    acknowledgeInput: () => undefined,
    verifyEvidence,
    executeAction,
    reportException: () => undefined,
    retrySubmission,
    reload,
    loadMore,
  };
}
