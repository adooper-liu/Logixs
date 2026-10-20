import type {
  ConfirmTaskActionCandidateCommandV1,
  TaskActionCandidateV1,
  TaskActionClaimWorkOrderResultV1,
  TaskActionDecisionV1,
  TaskAssistantSubjectRefV1,
  TaskAssistantWorkRefV1,
} from "@logix/contracts";
import { shallowRef, watch, type Ref, type ShallowRef } from "vue";
import {
  confirmTaskActionCandidate,
  generateTaskActionCandidate,
  getTaskActionCandidate,
  rejectTaskActionCandidate,
} from "../api/taskAiAssistance";
import { HttpRequestError } from "../api/httpClient";

export interface TaskAiAssistanceContext {
  contextKey: string;
  taskId: string;
  subjectRef: TaskAssistantSubjectRefV1;
  workRef: TaskAssistantWorkRefV1;
}

export type TaskAiAssistanceRetryTarget = "generate" | "confirm" | "context";
export type TaskAiAssistancePrimaryRetryTarget = "generate" | "context";

export interface TaskAiAssistanceFacts {
  objectLabel: string;
  taskLabel: string;
  actionLabel: "领取";
  responsibilityLabel: string;
  dueLabel: string;
  fixtureLabel?: string;
}

export interface TaskAiAssistanceState {
  loading: ShallowRef<boolean>;
  error: ShallowRef<string>;
  retryable: ShallowRef<boolean>;
  primaryRetryTarget: ShallowRef<TaskAiAssistancePrimaryRetryTarget | null>;
  candidate: ShallowRef<TaskActionCandidateV1 | null>;
  decision: ShallowRef<TaskActionDecisionV1 | null>;
  confirming: ShallowRef<boolean>;
  rejecting: ShallowRef<boolean>;
  confirmError: ShallowRef<string>;
  rejectError: ShallowRef<string>;
  pendingConfirmCommand: ShallowRef<ConfirmTaskActionCandidateCommandV1 | null>;
  receipt: ShallowRef<TaskActionClaimWorkOrderResultV1 | null>;
  idempotencyReplay: ShallowRef<boolean | null>;
  confirm(): Promise<void>;
  reject(reason?: string): Promise<void>;
  retry(target: TaskAiAssistanceRetryTarget): Promise<void>;
  refresh(): Promise<void>;
}

export interface TaskAiAssistancePanelModel extends TaskAiAssistanceState {
  facts: TaskAiAssistanceFacts;
}

export function useTaskAiAssistance(
  context: Readonly<Ref<TaskAiAssistanceContext | null>>,
  options: { refreshTask(): Promise<void> | void },
): TaskAiAssistanceState {
  const loading = shallowRef(false);
  const error = shallowRef("");
  const retryable = shallowRef(false);
  const primaryRetryTarget =
    shallowRef<TaskAiAssistancePrimaryRetryTarget | null>(null);
  const candidate = shallowRef<TaskActionCandidateV1 | null>(null);
  const decision = shallowRef<TaskActionDecisionV1 | null>(null);
  const confirming = shallowRef(false);
  const rejecting = shallowRef(false);
  const confirmError = shallowRef("");
  const rejectError = shallowRef("");
  const pendingConfirmCommand =
    shallowRef<ConfirmTaskActionCandidateCommandV1 | null>(null);
  const receipt = shallowRef<TaskActionClaimWorkOrderResultV1 | null>(null);
  const idempotencyReplay = shallowRef<boolean | null>(null);
  const controllers = new Set<AbortController>();
  let generation = 0;
  let activeContext: TaskAiAssistanceContext | null = null;
  let preservedRefreshContextKey: string | null = null;

  function abortRequests(): void {
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  function clearSensitiveState(): void {
    candidate.value = null;
    decision.value = null;
    pendingConfirmCommand.value = null;
    receipt.value = null;
    idempotencyReplay.value = null;
  }

  function clearContextState(): void {
    clearSensitiveState();
    loading.value = false;
    confirming.value = false;
    rejecting.value = false;
    error.value = "";
    confirmError.value = "";
    rejectError.value = "";
    retryable.value = false;
    primaryRetryTarget.value = null;
  }

  function invalidateContext(
    nextContext: TaskAiAssistanceContext | null,
  ): void {
    generation += 1;
    abortRequests();
    activeContext = nextContext;
    clearContextState();
    if (nextContext) void generate();
  }

  function isCurrent(
    requestGeneration: number,
    requestContext: TaskAiAssistanceContext,
  ): boolean {
    return (
      requestGeneration === generation &&
      activeContext?.contextKey === requestContext.contextKey
    );
  }

  function requestScope(): {
    requestGeneration: number;
    requestContext: TaskAiAssistanceContext;
    controller: AbortController;
  } | null {
    if (!activeContext) return null;
    const controller = new AbortController();
    controllers.add(controller);
    return {
      requestGeneration: generation,
      requestContext: activeContext,
      controller,
    };
  }

  function release(controller: AbortController): void {
    controllers.delete(controller);
  }

  function applyCandidate(next: TaskActionCandidateV1): void {
    const pending = pendingConfirmCommand.value;
    if (
      pending &&
      (pending.candidateId !== next.candidateId ||
        pending.candidateHash !== next.candidateHash)
    ) {
      pendingConfirmCommand.value = null;
      confirmError.value = "";
    }
    candidate.value = next;
  }

  function clearRecoveredInlineErrors(): void {
    if (!pendingConfirmCommand.value) confirmError.value = "";
    rejectError.value = "";
  }

  function clearForAccessChange(
    message: string,
    target: "error" | "confirm" | "reject" = "error",
  ): void {
    clearSensitiveState();
    error.value = target === "error" ? message : "";
    confirmError.value = target === "confirm" ? message : "";
    rejectError.value = target === "reject" ? message : "";
    retryable.value = true;
    primaryRetryTarget.value = "context";
  }

  async function generate(): Promise<void> {
    const scope = requestScope();
    if (!scope) return;
    const { requestGeneration, requestContext, controller } = scope;
    loading.value = true;
    error.value = "";
    retryable.value = false;
    primaryRetryTarget.value = null;
    try {
      const next = await generateTaskActionCandidate(
        requestContext.taskId,
        {
          contractVersion: "task-action-candidate-generate.v1",
          subjectRef: requestContext.subjectRef,
          workRef: requestContext.workRef,
        },
        controller.signal,
      );
      if (!isCurrent(requestGeneration, requestContext)) return;
      applyCandidate(next);
      clearRecoveredInlineErrors();
    } catch (cause) {
      if (!isCurrent(requestGeneration, requestContext)) return;
      if (controller.signal.aborted) return;
      clearSensitiveState();
      if (isNoClaim(cause)) {
        error.value = "当前没有可建议的领取动作";
        retryable.value = false;
        primaryRetryTarget.value = null;
      } else if (isAccessChange(cause)) {
        clearForAccessChange(
          "任务建议已不可读取，请重新读取任务和授权。\n" + errorMessage(cause),
        );
      } else {
        error.value = errorMessage(cause);
        retryable.value = true;
        primaryRetryTarget.value = "generate";
      }
    } finally {
      release(controller);
      if (isCurrent(requestGeneration, requestContext)) loading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    if (!candidate.value) {
      await generate();
      return;
    }
    const requestedCandidateId = candidate.value.candidateId;
    const scope = requestScope();
    if (!scope) return;
    const { requestGeneration, requestContext, controller } = scope;
    loading.value = true;
    error.value = "";
    try {
      const next = await getTaskActionCandidate(
        requestContext.taskId,
        requestedCandidateId,
        controller.signal,
      );
      if (!isCurrent(requestGeneration, requestContext)) return;
      applyCandidate(next);
      clearRecoveredInlineErrors();
    } catch (cause) {
      if (!isCurrent(requestGeneration, requestContext)) return;
      if (controller.signal.aborted) return;
      if (isAccessChange(cause)) {
        clearForAccessChange(
          "任务建议已不可读取，请重新读取任务和授权。\n" + errorMessage(cause),
        );
      } else {
        error.value = errorMessage(cause);
        retryable.value = true;
      }
    } finally {
      release(controller);
      if (isCurrent(requestGeneration, requestContext)) loading.value = false;
    }
  }

  async function reloadAfterConflict(
    requestGeneration: number,
    requestContext: TaskAiAssistanceContext,
    requestedCandidateId: string,
  ): Promise<ConflictReloadOutcome> {
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const [candidateResult, contextResult] = await Promise.allSettled([
        getTaskActionCandidate(
          requestContext.taskId,
          requestedCandidateId,
          controller.signal,
        ),
        refreshCurrentTask(requestContext),
      ]);

      const currentContext = context.value;
      const failure = [candidateResult, contextResult].find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )?.reason;
      if (currentContext?.contextKey !== requestContext.contextKey) {
        if (!currentContext) {
          return {
            kind: "access_changed",
            message: accessRecoveryMessage(failure),
          };
        }
        return { kind: "stale_context" };
      }
      if (!isCurrent(requestGeneration, requestContext)) {
        return { kind: "stale_context" };
      }
      if (failure !== undefined) {
        return isAccessChange(failure)
          ? {
              kind: "access_changed",
              message: accessRecoveryMessage(failure),
            }
          : { kind: "failed", message: errorMessage(failure) };
      }
      if (candidateResult.status !== "fulfilled") {
        return { kind: "failed", message: "重新读取建议失败。" };
      }
      applyCandidate(candidateResult.value);
      return { kind: "reloaded" };
    } finally {
      release(controller);
    }
  }

  async function refreshCurrentTask(
    requestContext: TaskAiAssistanceContext,
  ): Promise<void> {
    preservedRefreshContextKey = requestContext.contextKey;
    try {
      await options.refreshTask();
    } finally {
      const currentContext = context.value;
      if (currentContext?.contextKey === requestContext.contextKey) {
        activeContext = currentContext;
      } else if (preservedRefreshContextKey === requestContext.contextKey) {
        preservedRefreshContextKey = null;
        invalidateContext(currentContext);
      }
      if (preservedRefreshContextKey === requestContext.contextKey) {
        preservedRefreshContextKey = null;
      }
    }
  }

  async function confirm(): Promise<void> {
    const currentCandidate = candidate.value;
    if (!currentCandidate || currentCandidate.status !== "proposed") return;
    const command =
      pendingConfirmCommand.value?.candidateId ===
        currentCandidate.candidateId &&
      pendingConfirmCommand.value.candidateHash ===
        currentCandidate.candidateHash
        ? pendingConfirmCommand.value
        : {
            contractVersion: "task-action-candidate-confirm.v1" as const,
            candidateId: currentCandidate.candidateId,
            candidateHash: currentCandidate.candidateHash,
            idempotencyKey: crypto.randomUUID(),
          };
    pendingConfirmCommand.value = command;
    const scope = requestScope();
    if (!scope) return;
    const { requestGeneration, requestContext, controller } = scope;
    confirming.value = true;
    confirmError.value = "";
    try {
      const result = await confirmTaskActionCandidate(
        requestContext.taskId,
        currentCandidate.candidateId,
        command,
        controller.signal,
      );
      if (!isCurrent(requestGeneration, requestContext)) return;
      applyCandidate(result.candidate);
      decision.value = result.decision;
      receipt.value = result.claimWorkOrderResult;
      idempotencyReplay.value = result.idempotencyReplay;
      pendingConfirmCommand.value = null;
      await refreshCurrentTask(requestContext);
    } catch (cause) {
      if (!isCurrent(requestGeneration, requestContext)) return;
      if (controller.signal.aborted) return;
      if (isAccessChange(cause)) {
        clearForAccessChange(
          "任务建议已不可执行，请重新读取任务和授权。\n" + errorMessage(cause),
          "confirm",
        );
      } else if (isConflict(cause)) {
        pendingConfirmCommand.value = null;
        receipt.value = null;
        idempotencyReplay.value = null;
        const outcome = await reloadAfterConflict(
          requestGeneration,
          requestContext,
          currentCandidate.candidateId,
        );
        if (outcome.kind === "access_changed") {
          clearForAccessChange(outcome.message, "confirm");
        } else if (
          outcome.kind === "reloaded" &&
          isCurrent(requestGeneration, requestContext)
        ) {
          confirmError.value = "建议已发生冲突，已重新读取当前候选和任务。";
        } else if (
          outcome.kind === "failed" &&
          isCurrent(requestGeneration, requestContext)
        ) {
          confirmError.value = outcome.message;
        }
      } else {
        confirmError.value = errorMessage(cause);
      }
    } finally {
      release(controller);
      if (isCurrent(requestGeneration, requestContext))
        confirming.value = false;
    }
  }

  async function reject(reason?: string): Promise<void> {
    const currentCandidate = candidate.value;
    if (!currentCandidate || currentCandidate.status !== "proposed") return;
    const scope = requestScope();
    if (!scope) return;
    const { requestGeneration, requestContext, controller } = scope;
    rejecting.value = true;
    rejectError.value = "";
    try {
      const result = await rejectTaskActionCandidate(
        requestContext.taskId,
        currentCandidate.candidateId,
        {
          contractVersion: "task-action-candidate-reject.v1",
          candidateId: currentCandidate.candidateId,
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        },
        controller.signal,
      );
      if (!isCurrent(requestGeneration, requestContext)) return;
      decision.value = result;
      candidate.value = { ...currentCandidate, status: "rejected" };
      pendingConfirmCommand.value = null;
    } catch (cause) {
      if (!isCurrent(requestGeneration, requestContext)) return;
      if (controller.signal.aborted) return;
      if (isAccessChange(cause)) {
        clearForAccessChange(
          "任务建议已不可读取，请重新读取任务和授权。\n" + errorMessage(cause),
          "reject",
        );
      } else if (isConflict(cause)) {
        const outcome = await reloadAfterConflict(
          requestGeneration,
          requestContext,
          currentCandidate.candidateId,
        );
        if (outcome.kind === "access_changed") {
          clearForAccessChange(outcome.message, "reject");
        } else if (
          outcome.kind === "reloaded" &&
          isCurrent(requestGeneration, requestContext)
        ) {
          rejectError.value = "建议已发生冲突，已重新读取当前候选和任务。";
        } else if (
          outcome.kind === "failed" &&
          isCurrent(requestGeneration, requestContext)
        ) {
          rejectError.value = outcome.message;
        }
      } else {
        rejectError.value = errorMessage(cause);
      }
    } finally {
      release(controller);
      if (isCurrent(requestGeneration, requestContext)) rejecting.value = false;
    }
  }

  async function retry(target: TaskAiAssistanceRetryTarget): Promise<void> {
    if (target === "confirm") {
      await confirm();
      return;
    }
    if (target === "context") {
      const requestContext = activeContext;
      if (!requestContext) {
        try {
          await options.refreshTask();
        } catch (cause) {
          clearForAccessChange(accessRecoveryMessage(cause));
        }
        return;
      }
      try {
        await refreshCurrentTask(requestContext);
      } catch (cause) {
        clearForAccessChange(accessRecoveryMessage(cause));
        return;
      }
      if (
        activeContext?.contextKey !== requestContext.contextKey ||
        context.value?.contextKey !== requestContext.contextKey
      ) {
        return;
      }
    }
    await generate();
  }

  watch(
    () => context.value?.contextKey ?? null,
    (nextContextKey) => {
      const next = context.value;
      if ((next?.contextKey ?? null) !== nextContextKey) return;
      if (
        preservedRefreshContextKey &&
        (nextContextKey === null ||
          nextContextKey === preservedRefreshContextKey)
      ) {
        if (next) activeContext = next;
        return;
      }
      preservedRefreshContextKey = null;
      invalidateContext(next);
    },
    { flush: "sync", immediate: true },
  );

  return {
    loading,
    error,
    retryable,
    primaryRetryTarget,
    candidate,
    decision,
    confirming,
    rejecting,
    confirmError,
    rejectError,
    pendingConfirmCommand,
    receipt,
    idempotencyReplay,
    confirm,
    reject,
    retry,
    refresh,
  };
}

type ConflictReloadOutcome =
  | { kind: "reloaded" }
  | { kind: "access_changed"; message: string }
  | { kind: "stale_context" }
  | { kind: "failed"; message: string };

function accessRecoveryMessage(cause?: unknown): string {
  const prefix = "任务建议已不可读取，请重新读取任务和授权。";
  return cause === undefined ? prefix : `${prefix}\n${errorMessage(cause)}`;
}

function isNoClaim(cause: unknown): boolean {
  return (
    cause instanceof HttpRequestError &&
    cause.status === 409 &&
    /NO_CLAIM_ACTION|BUSINESS_PRECONDITION_FAILED/.test(cause.message)
  );
}

function isAccessChange(cause: unknown): boolean {
  return cause instanceof HttpRequestError && [403, 404].includes(cause.status);
}

function isConflict(cause: unknown): boolean {
  return cause instanceof HttpRequestError && cause.status === 409;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
