import type {
  ConfirmTaskActionCandidateCommandV1,
  GenerateTaskActionCandidateCommandV1,
  RejectTaskActionCandidateCommandV1,
  TaskActionCandidateV1,
  TaskActionConfirmResultV1,
  TaskActionDecisionV1,
} from "@logix/contracts";
import { flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpRequestError } from "../api/httpClient";

const generateTaskActionCandidate = vi.fn();
const getTaskActionCandidate = vi.fn();
const rejectTaskActionCandidate = vi.fn();
const confirmTaskActionCandidate = vi.fn();

vi.mock("../api/taskAiAssistance", () => ({
  generateTaskActionCandidate: (...args: unknown[]) =>
    generateTaskActionCandidate(...args),
  getTaskActionCandidate: (...args: unknown[]) =>
    getTaskActionCandidate(...args),
  rejectTaskActionCandidate: (...args: unknown[]) =>
    rejectTaskActionCandidate(...args),
  confirmTaskActionCandidate: (...args: unknown[]) =>
    confirmTaskActionCandidate(...args),
}));

const { useTaskAiAssistance } = await import("./useTaskAiAssistance");

describe("useTaskAiAssistance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTaskActionCandidate.mockImplementation((taskId: string) =>
      Promise.resolve(candidate(taskId === idFor("task", "B") ? "B" : "A")),
    );
    getTaskActionCandidate.mockImplementation((taskId: string) =>
      Promise.resolve(candidate(taskId === idFor("task", "B") ? "B" : "A")),
    );
    rejectTaskActionCandidate.mockResolvedValue(decision("rejected"));
    confirmTaskActionCandidate.mockResolvedValue(confirmResult());
  });

  it("does not request without exact context and auto-generates the fixed command when context appears", async () => {
    const context = ref<Context | null>(null);
    const refreshTask = vi.fn();
    const model = useTaskAiAssistance(context, { refreshTask });

    expect(generateTaskActionCandidate).not.toHaveBeenCalled();
    context.value = taskContext("A");
    await flushPromises();

    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
    const [taskId, command, signal] =
      generateTaskActionCandidate.mock.calls[0]!;
    expect(taskId).toBe(idFor("task", "A"));
    expect(command).toEqual<GenerateTaskActionCandidateCommandV1>({
      contractVersion: "task-action-candidate-generate.v1",
      subjectRef: { kind: "container", id: idFor("container", "A") },
      workRef: { kind: "node_task", id: idFor("task", "A") },
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "A"));
    expect(model.loading.value).toBe(false);
  });

  it("synchronously aborts and clears candidate, receipt, errors, and pending confirmation on context switch", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();
    await model.confirm();
    expect(model.candidate.value).not.toBeNull();
    expect(model.receipt.value).not.toBeNull();
    const heldGet = deferred<TaskActionCandidateV1>();
    getTaskActionCandidate.mockReturnValueOnce(heldGet.promise);
    void model.refresh();
    const firstSignal = getTaskActionCandidate.mock.calls[0]![2] as AbortSignal;

    context.value = taskContext("B");

    expect(firstSignal.aborted).toBe(true);
    expect(model.candidate.value).toBeNull();
    expect(model.receipt.value).toBeNull();
    expect(model.confirmError.value).toBe("");
    expect(model.pendingConfirmCommand.value).toBeNull();
    await flushPromises();
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "B"));
  });

  it("drops late generate success and failure from task A after switching to B", async () => {
    const a = deferred<TaskActionCandidateV1>();
    generateTaskActionCandidate
      .mockReturnValueOnce(a.promise)
      .mockResolvedValueOnce(candidate("B"));
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });

    context.value = taskContext("B");
    await flushPromises();
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "B"));

    a.resolve(candidate("A"));
    await flushPromises();
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "B"));
    expect(model.error.value).toBe("");
  });

  it.each(["NO_CLAIM_ACTION", "BUSINESS_PRECONDITION_FAILED"])(
    "shows non-retryable no-claim state for %s",
    async (code) => {
      generateTaskActionCandidate.mockRejectedValueOnce(httpError(409, code));
      const context = ref<Context | null>(taskContext("A"));
      const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
      await flushPromises();

      expect(model.candidate.value).toBeNull();
      expect(model.error.value).toBe("当前没有可建议的领取动作");
      expect(model.retryable.value).toBe(false);
    },
  );

  it.each([403, 404])(
    "clears sensitive state and requests context reread for generate HTTP %s",
    async (status) => {
      generateTaskActionCandidate.mockRejectedValueOnce(
        httpError(status, `FAIL_${status}`),
      );
      const context = ref<Context | null>(taskContext("A"));
      const refreshTask = vi.fn(async () => {
        context.value = null;
        await nextTick();
        context.value = { ...taskContext("A") };
        await nextTick();
      });
      const model = useTaskAiAssistance(context, { refreshTask });
      await flushPromises();

      expect(model.candidate.value).toBeNull();
      expect(model.receipt.value).toBeNull();
      expect(model.retryable.value).toBe(true);
      expect(model.error.value).toContain("重新读取");
      expect(retryTarget(model).value).toBe("context");

      generateTaskActionCandidate.mockClear();
      await model.retry(retryTarget(model).value!);
      await flushPromises();

      expect(refreshTask).toHaveBeenCalledTimes(1);
      expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
      expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "A"));
    },
  );

  it.each([
    ["HTTP 503", httpError(503, "TEMPORARY")],
    ["network failure", new Error("NETWORK_UNAVAILABLE")],
  ])("keeps generate retryable after %s", async (_label, cause) => {
    generateTaskActionCandidate.mockRejectedValueOnce(cause);
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn();
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();

    expect(model.candidate.value).toBeNull();
    expect(model.retryable.value).toBe(true);
    expect(model.error.value).toBe((cause as Error).message);
    expect(retryTarget(model).value).toBe("generate");

    generateTaskActionCandidate.mockClear();
    await model.retry(retryTarget(model).value!);
    await flushPromises();

    expect(refreshTask).not.toHaveBeenCalled();
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
  });

  it("rejects explicitly without confirming or generating a replacement", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();

    await model.reject("当前不领取");

    expect(rejectTaskActionCandidate).toHaveBeenCalledWith(
      idFor("task", "A"),
      idFor("candidate", "A"),
      {
        contractVersion: "task-action-candidate-reject.v1",
        candidateId: idFor("candidate", "A"),
        reason: "当前不领取",
      } satisfies RejectTaskActionCandidateCommandV1,
      expect.any(AbortSignal),
    );
    expect(confirmTaskActionCandidate).not.toHaveBeenCalled();
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
    expect(model.decision.value?.decision).toBe("rejected");
    expect(model.candidate.value?.status).toBe("rejected");
  });

  it("confirms only on demand, stores the formal receipt, and refreshes the task", async () => {
    const refreshTask = vi.fn().mockResolvedValue(undefined);
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();
    expect(confirmTaskActionCandidate).not.toHaveBeenCalled();

    await model.confirm();

    const command = confirmTaskActionCandidate.mock
      .calls[0]![2] as ConfirmTaskActionCandidateCommandV1;
    expect(command).toMatchObject({
      contractVersion: "task-action-candidate-confirm.v1",
      candidateId: idFor("candidate", "A"),
      candidateHash: "candidate-hash-A",
    });
    expect(command.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(model.decision.value?.decision).toBe("accepted");
    expect(model.receipt.value?.clientOperationId).toBe("operation-A");
    expect(model.idempotencyReplay.value).toBe(false);
    expect(model.pendingConfirmCommand.value).toBeNull();
    expect(refreshTask).toHaveBeenCalledTimes(1);
  });

  it("keeps the formal receipt when task refresh rebuilds the same semantic context", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = { ...taskContext("A") };
      await nextTick();
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();

    await model.confirm();
    await flushPromises();

    expect(model.receipt.value?.clientOperationId).toBe("operation-A");
    expect(model.decision.value?.decision).toBe("accepted");
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
  });

  it("keeps the formal receipt across the consumer's transient A-null-A reload", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = null;
      await nextTick();
      context.value = { ...taskContext("A") };
      await nextTick();
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();

    await model.confirm();
    await flushPromises();

    expect(model.receipt.value?.clientOperationId).toBe("operation-A");
    expect(model.decision.value?.decision).toBe("accepted");
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
  });

  it("invalidates A and aborts sibling requests when task refresh ends without context", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = null;
      await nextTick();
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();
    model.decision.value = decision("accepted");
    model.receipt.value = confirmResult().claimWorkOrderResult;
    model.pendingConfirmCommand.value = {
      contractVersion: "task-action-candidate-confirm.v1",
      candidateId: idFor("candidate", "A"),
      candidateHash: "candidate-hash-A",
      idempotencyKey: idFor("idempotency", "A"),
    };
    const heldGet = deferred<TaskActionCandidateV1>();
    getTaskActionCandidate.mockReturnValueOnce(heldGet.promise);
    const pendingGet = model.refresh();
    const getSignal = getTaskActionCandidate.mock.calls.at(
      -1,
    )![2] as AbortSignal;
    model.error.value = "旧生成错误";
    model.confirmError.value = "旧确认错误";
    model.rejectError.value = "旧拒绝错误";

    await model.retry("context");

    expect(getSignal.aborted).toBe(true);
    expect(model.candidate.value).toBeNull();
    expect(model.decision.value).toBeNull();
    expect(model.receipt.value).toBeNull();
    expect(model.pendingConfirmCommand.value).toBeNull();
    expect(model.error.value).toBe("");
    expect(model.confirmError.value).toBe("");
    expect(model.rejectError.value).toBe("");
    heldGet.resolve(candidate("A"));
    await pendingGet;

    const calls = {
      generate: generateTaskActionCandidate.mock.calls.length,
      confirm: confirmTaskActionCandidate.mock.calls.length,
      reject: rejectTaskActionCandidate.mock.calls.length,
    };
    await model.confirm();
    await model.reject();
    await model.retry("generate");
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(calls.generate);
    expect(confirmTaskActionCandidate).toHaveBeenCalledTimes(calls.confirm);
    expect(rejectTaskActionCandidate).toHaveBeenCalledTimes(calls.reject);
  });

  it("invalidates A, activates B once, and drops A late completion during refresh", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = taskContext("B");
      await nextTick();
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();
    const heldGet = deferred<TaskActionCandidateV1>();
    getTaskActionCandidate.mockReturnValueOnce(heldGet.promise);
    const pendingGet = model.refresh();
    const getSignal = getTaskActionCandidate.mock.calls.at(
      -1,
    )![2] as AbortSignal;
    generateTaskActionCandidate.mockClear();

    await model.retry("context");
    await flushPromises();

    expect(getSignal.aborted).toBe(true);
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
    expect(generateTaskActionCandidate.mock.calls[0]![0]).toBe(
      idFor("task", "B"),
    );
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "B"));
    heldGet.resolve(candidate("A"));
    await pendingGet;
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "B"));
    expect(model.error.value).toBe("");
  });

  it("clears A and exposes context recovery when refresh fails after context disappears", async () => {
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = null;
      await nextTick();
      throw httpError(404, "TASK_NOT_FOUND");
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();
    model.decision.value = decision("accepted");
    model.receipt.value = confirmResult().claimWorkOrderResult;

    await expect(model.retry("context")).resolves.toBeUndefined();

    expect(model.candidate.value).toBeNull();
    expect(model.decision.value).toBeNull();
    expect(model.receipt.value).toBeNull();
    expect(model.pendingConfirmCommand.value).toBeNull();
    expect(model.error.value).toContain("重新读取任务和授权");
    expect(retryTarget(model).value).toBe("context");
  });

  it("retains the exact candidate/hash/key after 503 and reuses it to recover", async () => {
    confirmTaskActionCandidate
      .mockRejectedValueOnce(httpError(503, "TEMPORARY"))
      .mockResolvedValueOnce(confirmResult());
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();

    await model.confirm();
    const first = confirmTaskActionCandidate.mock
      .calls[0]![2] as ConfirmTaskActionCandidateCommandV1;
    expect(model.pendingConfirmCommand.value).toEqual(first);
    expect(model.confirmError.value).toContain("TEMPORARY");

    await model.retry("confirm");
    const second = confirmTaskActionCandidate.mock
      .calls[1]![2] as ConfirmTaskActionCandidateCommandV1;
    expect(second).toEqual(first);
    expect(model.receipt.value?.clientOperationId).toBe("operation-A");
  });

  it("invalidates an old pending command when a reloaded candidate id or hash changes", async () => {
    confirmTaskActionCandidate.mockRejectedValueOnce(httpError(503, "DOWN"));
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();
    await model.confirm();
    expect(model.pendingConfirmCommand.value).not.toBeNull();
    getTaskActionCandidate.mockResolvedValueOnce({
      ...candidate("A"),
      candidateHash: "candidate-hash-replaced",
    });

    await model.refresh();

    expect(model.pendingConfirmCommand.value).toBeNull();
    expect(model.confirmError.value).toBe("");
  });

  it("treats confirm conflict as non-success, clears recovery, reloads candidate and task", async () => {
    confirmTaskActionCandidate.mockRejectedValueOnce(
      httpError(409, "CANDIDATE_ALREADY_DECIDED"),
    );
    getTaskActionCandidate.mockResolvedValueOnce({
      ...candidate("A"),
      status: "rejected",
    });
    const refreshTask = vi.fn().mockResolvedValue(undefined);
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();

    await model.confirm();

    expect(model.pendingConfirmCommand.value).toBeNull();
    expect(model.receipt.value).toBeNull();
    expect(model.confirmError.value).toContain("冲突");
    expect(getTaskActionCandidate).toHaveBeenCalledTimes(1);
    expect(refreshTask).toHaveBeenCalledTimes(1);
    expect(retryTarget(model).value).toBeNull();
  });

  it("keeps context recovery when confirm conflict reread loses candidate access", async () => {
    confirmTaskActionCandidate.mockRejectedValueOnce(
      httpError(409, "CANDIDATE_ALREADY_DECIDED"),
    );
    getTaskActionCandidate.mockRejectedValueOnce(
      httpError(403, "CANDIDATE_FORBIDDEN"),
    );
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();

    await model.confirm();

    expect(model.candidate.value).toBeNull();
    expect(model.receipt.value).toBeNull();
    expect(model.pendingConfirmCommand.value).toBeNull();
    expect(model.confirmError.value).toContain("重新读取任务和授权");
    expect(model.confirmError.value).not.toContain("发生冲突");
    expect(retryTarget(model).value).toBe("context");
  });

  it("keeps context recovery when confirm conflict task reread removes the context", async () => {
    confirmTaskActionCandidate.mockRejectedValueOnce(
      httpError(409, "CANDIDATE_ALREADY_DECIDED"),
    );
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = null;
      await nextTick();
      throw httpError(404, "TASK_NOT_FOUND");
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();

    await model.confirm();

    expect(model.candidate.value).toBeNull();
    expect(model.receipt.value).toBeNull();
    expect(model.confirmError.value).toContain("重新读取任务和授权");
    expect(model.confirmError.value).not.toContain("发生冲突");
    expect(retryTarget(model).value).toBe("context");
  });

  it.each([403, 404])(
    "clears candidate, receipt, and pending recovery after confirm HTTP %s",
    async (status) => {
      const context = ref<Context | null>(taskContext("A"));
      const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
      await flushPromises();
      await model.confirm();
      getTaskActionCandidate.mockResolvedValueOnce(candidate("A"));
      await model.refresh();
      confirmTaskActionCandidate.mockRejectedValueOnce(
        httpError(status, `CONFIRM_${status}`),
      );

      await model.confirm();

      expect(model.candidate.value).toBeNull();
      expect(model.receipt.value).toBeNull();
      expect(model.pendingConfirmCommand.value).toBeNull();
      expect(model.confirmError.value).toContain("重新读取");
    },
  );

  it.each([403, 404])(
    "clears sensitive context after reject HTTP %s",
    async (status) => {
      const context = ref<Context | null>(taskContext("A"));
      const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
      await flushPromises();
      await model.confirm();
      getTaskActionCandidate.mockResolvedValueOnce(candidate("A"));
      await model.refresh();
      rejectTaskActionCandidate.mockRejectedValueOnce(
        httpError(status, `REJECT_${status}`),
      );

      await model.reject("不领取");

      expect(model.candidate.value).toBeNull();
      expect(model.receipt.value).toBeNull();
      expect(model.pendingConfirmCommand.value).toBeNull();
      expect(model.rejectError.value).toContain("重新读取");
    },
  );

  it("reloads the candidate and task after reject conflict without confirming", async () => {
    rejectTaskActionCandidate.mockRejectedValueOnce(
      httpError(409, "CANDIDATE_ALREADY_DECIDED"),
    );
    getTaskActionCandidate.mockResolvedValueOnce({
      ...candidate("A"),
      status: "accepted",
    });
    const refreshTask = vi.fn().mockResolvedValue(undefined);
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();

    await model.reject("不领取");

    expect(model.rejectError.value).toContain("冲突");
    expect(model.candidate.value?.status).toBe("accepted");
    expect(getTaskActionCandidate).toHaveBeenCalledTimes(1);
    expect(refreshTask).toHaveBeenCalledTimes(1);
    expect(confirmTaskActionCandidate).not.toHaveBeenCalled();
  });

  it("keeps context recovery when reject conflict reread loses candidate access", async () => {
    rejectTaskActionCandidate.mockRejectedValueOnce(
      httpError(409, "CANDIDATE_ALREADY_DECIDED"),
    );
    getTaskActionCandidate.mockRejectedValueOnce(
      httpError(404, "CANDIDATE_NOT_FOUND"),
    );
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();

    await model.reject("不领取");

    expect(model.candidate.value).toBeNull();
    expect(model.rejectError.value).toContain("重新读取任务和授权");
    expect(model.rejectError.value).not.toContain("发生冲突");
    expect(retryTarget(model).value).toBe("context");
    expect(confirmTaskActionCandidate).not.toHaveBeenCalled();
  });

  it("generates exactly once after context retry reloads the same workspace context", async () => {
    generateTaskActionCandidate.mockRejectedValueOnce(
      new Error("NETWORK_UNAVAILABLE"),
    );
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = null;
      await nextTick();
      context.value = { ...taskContext("A") };
      await nextTick();
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();
    generateTaskActionCandidate.mockClear();

    await model.retry("context");
    await flushPromises();

    expect(refreshTask).toHaveBeenCalledTimes(1);
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "A"));
  });

  it("rereads context and generates exactly once for an expired candidate", async () => {
    getTaskActionCandidate.mockResolvedValueOnce({
      ...candidate("A"),
      status: "expired",
    });
    const context = ref<Context | null>(taskContext("A"));
    const refreshTask = vi.fn(async () => {
      context.value = null;
      await nextTick();
      context.value = { ...taskContext("A") };
      await nextTick();
    });
    const model = useTaskAiAssistance(context, { refreshTask });
    await flushPromises();
    await model.refresh();
    expect(model.candidate.value?.status).toBe("expired");
    generateTaskActionCandidate.mockClear();

    await model.retry("context");
    await flushPromises();

    expect(refreshTask).toHaveBeenCalledTimes(1);
    expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
    expect(model.candidate.value?.status).toBe("proposed");
  });

  it.each([
    ["confirm", 403],
    ["reject", 404],
  ] as const)(
    "clears stale %s access error after context recovery succeeds",
    async (action, status) => {
      if (action === "confirm") {
        confirmTaskActionCandidate.mockRejectedValueOnce(
          httpError(status, `CONFIRM_${status}`),
        );
      } else {
        rejectTaskActionCandidate.mockRejectedValueOnce(
          httpError(status, `REJECT_${status}`),
        );
      }
      const context = ref<Context | null>(taskContext("A"));
      const refreshTask = vi.fn(async () => {
        context.value = null;
        await nextTick();
        context.value = { ...taskContext("A") };
        await nextTick();
      });
      const model = useTaskAiAssistance(context, { refreshTask });
      await flushPromises();

      if (action === "confirm") await model.confirm();
      else await model.reject("不领取");
      expect(
        action === "confirm"
          ? model.confirmError.value
          : model.rejectError.value,
      ).toContain("重新读取任务和授权");

      generateTaskActionCandidate.mockClear();
      await model.retry("context");
      await flushPromises();

      expect(model.candidate.value?.status).toBe("proposed");
      expect(generateTaskActionCandidate).toHaveBeenCalledTimes(1);
      expect(model.confirmError.value).toBe("");
      expect(model.rejectError.value).toBe("");
    },
  );

  it("clears an ordinary conflict prompt after explicit candidate refresh succeeds", async () => {
    confirmTaskActionCandidate.mockRejectedValueOnce(
      httpError(409, "CANDIDATE_ALREADY_DECIDED"),
    );
    getTaskActionCandidate.mockResolvedValueOnce({
      ...candidate("A"),
      status: "rejected",
    });
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, {
      refreshTask: vi.fn().mockResolvedValue(undefined),
    });
    await flushPromises();
    await model.confirm();
    expect(model.confirmError.value).toContain("冲突");

    getTaskActionCandidate.mockResolvedValueOnce(candidate("A"));
    await model.refresh();

    expect(model.candidate.value?.status).toBe("proposed");
    expect(model.confirmError.value).toBe("");
  });

  it("drops late get, confirm, reject success/error/finally after context switch", async () => {
    const confirmA = deferred<TaskActionConfirmResultV1>();
    confirmTaskActionCandidate.mockReturnValueOnce(confirmA.promise);
    const context = ref<Context | null>(taskContext("A"));
    const model = useTaskAiAssistance(context, { refreshTask: vi.fn() });
    await flushPromises();
    const pendingConfirm = model.confirm();
    expect(model.confirming.value).toBe(true);

    context.value = taskContext("B");
    expect(model.confirming.value).toBe(false);
    await flushPromises();
    confirmA.resolve(confirmResult("A"));
    await pendingConfirm;
    await nextTick();

    expect(model.candidate.value?.candidateId).toBe(idFor("candidate", "B"));
    expect(model.receipt.value).toBeNull();
    expect(model.confirming.value).toBe(false);
  });
});

type Context = {
  contextKey: string;
  taskId: string;
  subjectRef: { kind: "container"; id: string };
  workRef: { kind: "node_task"; id: string };
};

function taskContext(suffix: string): Context {
  return {
    contextKey: `container:${suffix}|node_task:${suffix}`,
    taskId: idFor("task", suffix),
    subjectRef: { kind: "container", id: idFor("container", suffix) },
    workRef: { kind: "node_task", id: idFor("task", suffix) },
  };
}

function candidate(suffix = "A"): TaskActionCandidateV1 {
  return {
    candidateId: idFor("candidate", suffix),
    candidateHash: `candidate-hash-${suffix}`,
    context: {
      subjectRef: { kind: "container", id: idFor("container", suffix) },
      workRef: { kind: "node_task", id: idFor("task", suffix) },
    },
    workOrderId: idFor("work-order", suffix),
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: "建议领取当前任务",
    rationale: "当前工单处于可领取状态。",
    impact: "确认后将由服务端重新验证并领取。",
    riskLevel: "low",
    warningCodes: [],
    status: "proposed",
    source: {
      kind: "rule",
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: `snapshot-${suffix}`,
      inputRefs: [],
      generatedAt: "2026-10-20T08:00:00.000Z",
    },
  };
}

function decision(
  kind: "accepted" | "rejected",
  suffix = "A",
): TaskActionDecisionV1 {
  return {
    decisionId: idFor("decision", suffix),
    candidateId: idFor("candidate", suffix),
    decidedByActorId: "actor-1",
    decision: kind,
    reason: kind === "rejected" ? "当前不领取" : null,
    idempotencyKey: idFor("idempotency", suffix),
    decidedAt: "2026-10-20T08:01:00.000Z",
    clientOperationId: kind === "accepted" ? `operation-${suffix}` : null,
    traceId: kind === "accepted" ? `trace-${suffix}` : null,
    executionState: kind === "accepted" ? "applied" : null,
    resultRefs: [],
  };
}

function confirmResult(suffix = "A"): TaskActionConfirmResultV1 {
  return {
    contractVersion: "task-action-candidate-confirm-result.v1",
    candidate: { ...candidate(suffix), status: "accepted" },
    decision: decision("accepted", suffix),
    claimWorkOrderResult: {
      workOrderId: idFor("work-order", suffix),
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: "actor-1",
      taskId: idFor("task", suffix),
      taskState: "in_progress",
      applied: true,
      clientOperationId: `operation-${suffix}`,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    },
    idempotencyReplay: false,
  };
}

function httpError(status: number, code: string): HttpRequestError {
  return new HttpRequestError({
    kind: status === 403 ? "forbidden" : "http",
    status,
    message: code,
  });
}

function idFor(kind: string, suffix: string): string {
  const seeds: Record<string, string> = {
    container: "11111111-1111-4111-8111-11111111111",
    task: "22222222-2222-4222-8222-22222222222",
    candidate: "33333333-3333-4333-8333-33333333333",
    "work-order": "44444444-4444-4444-8444-44444444444",
    decision: "55555555-5555-4555-8555-55555555555",
    idempotency: "66666666-6666-4666-8666-66666666666",
  };
  return `${seeds[kind]}${suffix.charCodeAt(0) % 10}`;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function retryTarget(model: ReturnType<typeof useTaskAiAssistance>): {
  value: "generate" | "context" | null;
} {
  return (
    model as typeof model & {
      primaryRetryTarget: { value: "generate" | "context" | null };
    }
  ).primaryRetryTarget;
}
