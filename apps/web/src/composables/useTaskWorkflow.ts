import { computed, onUnmounted, shallowRef } from "vue";
import type { SubmissionView, TaskAction } from "../data/sample";
import { useDemoOperationsStore } from "./useDemoOperationsStore";

interface UseTaskWorkflowOptions {
  stepDelayMs?: number;
  submissionOutcome?: "committed" | "timeout";
}

interface PendingCommand {
  action: TaskAction;
  detail?: string;
}

const idleSubmission = (taskId: string): SubmissionView => ({
  taskId,
  stage: "idle",
});

export function useTaskWorkflow(options: UseTaskWorkflowOptions = {}) {
  const { stepDelayMs = 350, submissionOutcome = "committed" } = options;
  const store = useDemoOperationsStore();
  const initialTask =
    store.tasks.value.find((task) => task.queueKind === "human") ??
    store.tasks.value[0];
  const activeTaskId = shallowRef(initialTask.taskId);
  const timers: number[] = [];
  const pendingCommands = new Map<string, PendingCommand>();

  const activeTask = computed(
    () => store.getTask(activeTaskId.value) ?? initialTask,
  );
  const activeContainer = computed(() => {
    const container = store.getContainer(activeTask.value.containerRecordId);
    if (!container)
      throw new Error(
        `Missing container projection for ${activeTask.value.containerRecordId}`,
      );
    return container;
  });
  const activeSubmission = computed(
    () =>
      store.submissions.value[activeTaskId.value] ??
      idleSubmission(activeTaskId.value),
  );
  const isSubmitting = computed(
    () =>
      ["sending", "received", "accepted"].includes(
        activeSubmission.value.stage,
      ) && !activeSubmission.value.canRetry,
  );
  const canSubmit = computed(() => {
    const task = activeTask.value;
    const assignmentReady =
      task.assignment.mode !== "pool" || Boolean(task.assignment.assignee);
    const preconditionsMet = task.preconditions.every(
      (condition) => condition.state === "met",
    );
    const inputsReady = task.requiredInputs.every(
      (input) => input.state === "ready",
    );
    const evidenceReady = task.evidenceRequirements
      .filter((evidence) => evidence.required)
      .every((evidence) => evidence.state === "verified");
    const actionableStatus = ![
      "blocked",
      "completed",
      "waiting_external",
      "reported",
    ].includes(task.status);

    return (
      assignmentReady &&
      preconditionsMet &&
      inputsReady &&
      evidenceReady &&
      actionableStatus &&
      !isSubmitting.value
    );
  });

  const clearTimers = () => {
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
  };

  const selectTask = (taskId: string) => {
    if (isSubmitting.value) return;
    const target = store.tasks.value.find(
      (task) => task.taskId === taskId && task.queueKind === "human",
    );
    if (target) activeTaskId.value = target.taskId;
  };

  const canExecuteAction = (action: TaskAction) => {
    if (isSubmitting.value) return false;
    return action.intent === "exception" || canSubmit.value;
  };

  const scheduleCommand = (
    taskId: string,
    command: PendingCommand,
    operationId?: string,
  ) => {
    clearTimers();
    pendingCommands.set(taskId, command);
    store.startOperation(taskId, command.action.actionCode, operationId);

    timers.push(
      window.setTimeout(() => {
        store.markReceived(taskId);
      }, stepDelayMs),
    );

    if (submissionOutcome === "timeout") {
      timers.push(
        window.setTimeout(() => {
          store.markRetryable(
            taskId,
            "请求已接收，但业务决定暂时不可用；请使用原操作编号查询或重试",
          );
        }, stepDelayMs * 2),
      );
      return;
    }

    timers.push(
      window.setTimeout(() => {
        store.markAccepted(taskId, command.action);
      }, stepDelayMs * 2),
    );
    timers.push(
      window.setTimeout(() => {
        if (command.action.intent === "exception") {
          store.commitException(
            taskId,
            command.action,
            command.detail ?? "未提供异常说明",
          );
        } else {
          store.commitTaskResult(taskId, command.action);
        }
      }, stepDelayMs * 3),
    );
  };

  const executeAction = (actionCode: string) => {
    const task = activeTask.value;
    const action = task.actions.find(
      (item) => item.actionCode === actionCode && item.intent === "complete",
    );
    if (!action || !canExecuteAction(action)) return;
    scheduleCommand(task.taskId, { action });
  };

  const reportException = (detail: string) => {
    const task = activeTask.value;
    const action = task.actions.find((item) => item.intent === "exception");
    if (!action || !detail.trim() || !canExecuteAction(action)) return;
    scheduleCommand(task.taskId, { action, detail: detail.trim() });
  };

  const retrySubmission = () => {
    const submission = activeSubmission.value;
    const command = pendingCommands.get(activeTaskId.value);
    if (!submission.canRetry || !submission.clientOperationId || !command)
      return;
    scheduleCommand(activeTaskId.value, command, submission.clientOperationId);
  };

  onUnmounted(clearTimers);

  return {
    containers: store.containers,
    tasks: store.tasks,
    exceptions: store.exceptions,
    activeTaskId,
    activeTask,
    activeContainer,
    activeSubmission,
    canSubmit,
    isSubmitting,
    canExecuteAction,
    selectTask,
    claimTask: () => store.claimTask(activeTaskId.value),
    acknowledgeInput: (inputId: string) =>
      store.acknowledgeInput(activeTaskId.value, inputId),
    verifyEvidence: (evidenceId: string, value?: string) =>
      store.verifyEvidence(activeTaskId.value, evidenceId, value),
    executeAction,
    reportException,
    retrySubmission,
  };
}
