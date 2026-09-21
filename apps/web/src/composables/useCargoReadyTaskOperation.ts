import { computed, ref, shallowRef, type Ref } from "vue";
import {
  claimWorkOrder,
  completeWorkOrder,
  type NodeTaskDetail,
} from "../api/nodeTasks";
import {
  CLAIM_WORK_ORDER_ACTION,
  toClaimSubmission,
} from "../data/claimReceiptContract";
import {
  COMPLETE_WORK_ORDER_ACTION,
  toCompleteSubmission,
  toFailedSubmission,
  toSendingSubmission,
} from "../data/completeReceiptContract";
import type { SubmissionView } from "../data/sample";

export function useCargoReadyTaskOperation(
  task: Ref<NodeTaskDetail | null>,
  reload: () => Promise<void>,
) {
  const submitting = shallowRef(false);
  const submissions = ref<Record<string, SubmissionView>>({});
  const idempotencyKeys = new Map<string, string>();

  const submission = computed(() =>
    task.value ? (submissions.value[task.value.id] ?? null) : null,
  );

  async function execute(reuseKey = false): Promise<void> {
    const currentTask = task.value;
    const action = currentTask?.nextAction;
    if (!currentTask || !action || submitting.value) return;

    submitting.value = true;
    remember(
      currentTask.id,
      toSendingSubmission(currentTask.id, action.actionCode),
    );
    const idempotencyKey = nextIdempotencyKey(action.workOrderId, reuseKey);
    try {
      if (action.actionCode === CLAIM_WORK_ORDER_ACTION) {
        const result = await claimWorkOrder(action.workOrderId, {
          idempotencyKey,
        });
        remember(
          currentTask.id,
          toClaimSubmission({
            taskId: currentTask.id,
            result,
            observedAt: observedAt(),
          }),
        );
      } else if (action.actionCode === COMPLETE_WORK_ORDER_ACTION) {
        const result = await completeWorkOrder(action.workOrderId, {
          evidenceRefs: [],
          idempotencyKey,
        });
        remember(
          currentTask.id,
          toCompleteSubmission({
            taskId: currentTask.id,
            result,
            observedAt: observedAt(),
          }),
        );
      } else {
        throw new Error("ACTION_NOT_ALLOWED: 当前动作不受此工作台支持");
      }

      if (submissions.value[currentTask.id]?.stage === "committed") {
        idempotencyKeys.delete(action.workOrderId);
        await reload();
      }
    } catch (cause) {
      remember(
        currentTask.id,
        toFailedSubmission({
          taskId: currentTask.id,
          actionCode: action.actionCode,
          message: cause instanceof Error ? cause.message : "当前操作没有完成",
        }),
      );
    } finally {
      submitting.value = false;
    }
  }

  function retry(): Promise<void> {
    return execute(true);
  }

  function remember(taskId: string, value: SubmissionView): void {
    submissions.value = { ...submissions.value, [taskId]: value };
  }

  function nextIdempotencyKey(workOrderId: string, reuse: boolean): string {
    const existing = idempotencyKeys.get(workOrderId);
    if (reuse && existing) return existing;
    const key = crypto.randomUUID();
    idempotencyKeys.set(workOrderId, key);
    return key;
  }

  return {
    submission,
    submitting,
    execute,
    retry,
  };
}

function observedAt(): string {
  return new Date().toLocaleTimeString();
}
