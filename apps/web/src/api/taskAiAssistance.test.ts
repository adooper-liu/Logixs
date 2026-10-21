import type {
  ConfirmTaskActionCandidateCommandV1,
  GenerateTaskActionCandidateCommandV1,
  RejectTaskActionCandidateCommandV1,
  TaskActionCandidateV1,
  TaskActionConfirmResultV1,
  TaskActionDecisionV1,
} from "@logix/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession, RequestCredentials } from "../auth/session";

const credentials = vi.fn<() => Promise<RequestCredentials>>();
vi.mock("../auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/session")>()),
  getAuthSession: () =>
    ({
      credentials,
      handleUnauthorized: vi.fn(),
      confirmAuthorized: vi.fn(),
    }) as unknown as AuthSession,
}));

const {
  confirmTaskActionCandidate,
  generateTaskActionCandidate,
  getTaskActionCandidate,
  rejectTaskActionCandidate,
} = await import("./taskAiAssistance");
const { HttpRequestError } = await import("./httpClient");
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  credentials.mockResolvedValue({
    mode: "development",
    tenantId: "tenant-dev",
    operatorId: "operator-dev",
    roles: ["operations_dispatcher"],
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("task AI assistance API", () => {
  it("generates on the exact task route and forwards only the contract command and signal", async () => {
    const command: GenerateTaskActionCandidateCommandV1 = {
      contractVersion: "task-action-candidate-generate.v1",
      subjectRef: { kind: "container", id: id(1) },
      workRef: { kind: "node_task", id: id(2) },
    };
    const controller = new AbortController();
    fetchMock.mockResolvedValue(ok(candidate()));

    await expect(
      generateTaskActionCandidate("task/id", command, controller.signal),
    ).resolves.toEqual(candidate());

    expectRequest(
      "/api/node-tasks/task%2Fid/ai/action-candidates",
      "POST",
      command,
      controller.signal,
    );
    expectForbiddenFields(fetchMock.mock.calls[0]?.[1]?.body);
  });

  it("gets the candidate on the exact encoded route and forwards the signal", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(ok(candidate()));

    await getTaskActionCandidate("task/id", "candidate/id", controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/node-tasks/task%2Fid/ai/action-candidates/candidate%2Fid",
      expect.objectContaining({ method: "GET", signal: controller.signal }),
    );
  });

  it("rejects on the exact route without execution fields", async () => {
    const command: RejectTaskActionCandidateCommandV1 = {
      contractVersion: "task-action-candidate-reject.v1",
      candidateId: id(3),
      reason: "当前不领取",
    };
    const controller = new AbortController();
    fetchMock.mockResolvedValue(ok(decision("rejected")));

    await rejectTaskActionCandidate(
      "task/id",
      "candidate/id",
      command,
      controller.signal,
    );

    expectRequest(
      "/api/node-tasks/task%2Fid/ai/action-candidates/candidate%2Fid/rejections",
      "POST",
      command,
      controller.signal,
    );
    expectForbiddenFields(fetchMock.mock.calls[0]?.[1]?.body);
  });

  it("confirms on the exact route with the immutable idempotent command", async () => {
    const command: ConfirmTaskActionCandidateCommandV1 = {
      contractVersion: "task-action-candidate-confirm.v1",
      candidateId: id(3),
      candidateHash: "candidate-hash",
      idempotencyKey: id(9),
    };
    const controller = new AbortController();
    fetchMock.mockResolvedValue(ok(confirmResult()));

    await confirmTaskActionCandidate(
      "task/id",
      "candidate/id",
      command,
      controller.signal,
    );

    expectRequest(
      "/api/node-tasks/task%2Fid/ai/action-candidates/candidate%2Fid/confirmations",
      "POST",
      command,
      controller.signal,
    );
    expectForbiddenFields(fetchMock.mock.calls[0]?.[1]?.body);
  });

  it.each([403, 404, 409, 503])(
    "preserves shared HttpRequestError for HTTP %s",
    async (status) => {
      fetchMock.mockResolvedValue(
        response(status, { message: `failure-${status}`, traceId: "trace-1" }),
      );

      const error = await getTaskActionCandidate(
        "task-1",
        id(3),
        new AbortController().signal,
      ).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(HttpRequestError);
      expect(error).toMatchObject({ status, traceId: "trace-1" });
    },
  );

  it("preserves GC-011 code and reason details through the task adapter", async () => {
    fetchMock.mockResolvedValue(
      response(409, {
        success: false,
        error: {
          code: "BUSINESS_PRECONDITION_FAILED",
          message: "当前没有可建议的领取动作。",
          category: "precondition",
          retryable: false,
          details: [
            {
              reasonCode: "NO_CLAIM_ACTION",
              message: "当前任务没有可领取的工单动作。",
            },
          ],
        },
        traceId: "server-trace",
        timestamp: "2026-10-20T00:00:00.000Z",
      }),
    );

    const error = await getTaskActionCandidate(
      "task-1",
      id(3),
      new AbortController().signal,
    ).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(HttpRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "BUSINESS_PRECONDITION_FAILED",
      details: [expect.objectContaining({ reasonCode: "NO_CLAIM_ACTION" })],
      traceId: "server-trace",
    });
  });
});

function expectRequest(
  url: string,
  method: string,
  body: unknown,
  signal: AbortSignal,
): void {
  expect(fetchMock).toHaveBeenCalledWith(
    url,
    expect.objectContaining({
      method,
      body: JSON.stringify(body),
      signal,
    }),
  );
}

function expectForbiddenFields(rawBody: unknown): void {
  const sent = JSON.parse(String(rawBody)) as Record<string, unknown>;
  for (const field of [
    "tenantId",
    "actorId",
    "capabilities",
    "actionCode",
    "workOrderId",
    "risk",
    "traceId",
    "payload",
  ]) {
    expect(sent).not.toHaveProperty(field);
  }
}

function candidate(): TaskActionCandidateV1 {
  return {
    candidateId: id(3),
    candidateHash: "candidate-hash",
    context: {
      subjectRef: { kind: "container", id: id(1) },
      workRef: { kind: "node_task", id: id(2) },
    },
    workOrderId: id(4),
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
      inputSnapshotHash: "snapshot-hash",
      inputRefs: [],
      generatedAt: "2026-10-20T08:00:00.000Z",
    },
  };
}

function decision(kind: "accepted" | "rejected"): TaskActionDecisionV1 {
  return {
    decisionId: id(5),
    candidateId: id(3),
    decidedByActorId: "actor-1",
    decision: kind,
    reason: kind === "rejected" ? "当前不领取" : null,
    idempotencyKey: id(9),
    decidedAt: "2026-10-20T08:01:00.000Z",
    clientOperationId: kind === "accepted" ? "operation-1" : null,
    traceId: kind === "accepted" ? "trace-server" : null,
    executionState: kind === "accepted" ? "applied" : null,
    resultRefs: [],
  };
}

function confirmResult(): TaskActionConfirmResultV1 {
  return {
    contractVersion: "task-action-candidate-confirm-result.v1",
    candidate: { ...candidate(), status: "accepted" },
    decision: decision("accepted"),
    claimWorkOrderResult: {
      workOrderId: id(4),
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: "actor-1",
      taskId: id(2),
      taskState: "in_progress",
      applied: true,
      clientOperationId: "operation-1",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    },
    idempotencyReplay: false,
  };
}

function id(
  value: number,
): `${string}-${string}-${string}-${string}-${string}` {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function ok(body: unknown): Response {
  return response(200, body);
}

function response(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
