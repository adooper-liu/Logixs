import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  CandidateDecisionConflictError,
  CandidateNotFoundError,
} from "../domain/task-action-candidate.repository";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
  taskClaimSnapshotHash,
} from "./task-action-candidate.services";

const taskId = "10000000-0000-4000-8000-000000000001";
const containerId = "20000000-0000-4000-8000-000000000001";
const workOrderId = "30000000-0000-4000-8000-000000000001";
const candidateId = "40000000-0000-4000-8000-000000000001";
const operationId = "50000000-0000-4000-8000-000000000001";

describe("task action candidate application", () => {
  it("rejects generate path/work mismatch and missing task.read before access", async () => {
    const deps = fakes();
    const service = generateService(deps);
    await expect(
      service.execute({ ...generateInput(), taskId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.execute({ ...generateInput(), capabilities: [] }),
    ).rejects.toMatchObject({ status: 403 });
    expect(deps.execution.resolve).not.toHaveBeenCalled();
  });

  it("maps forbidden command fields to 400 before scope or claim access", async () => {
    const deps = fakes();
    await expect(
      generateService(deps).execute({
        ...generateInput(),
        command: { ...generateInput().command, actionCode: "forged" } as never,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      confirmService(deps).execute({
        ...confirmInput(),
        command: { ...confirmInput().command, payload: {} } as never,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(deps.execution.resolve).not.toHaveBeenCalled();
    expect(deps.execution.claim).not.toHaveBeenCalled();
  });

  it("hides tenant/container mismatch and refuses non-claim next actions", async () => {
    const deps = fakes();
    const service = generateService(deps);
    deps.execution.resolve.mockResolvedValueOnce(null);
    await expect(service.execute(generateInput())).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    deps.execution.resolve.mockResolvedValueOnce({
      ...snapshot(),
      nextAction: {
        ...snapshot().nextAction,
        actionCode: "work_execution.complete_work_order",
      },
    });
    await expect(service.execute(generateInput())).rejects.toThrow(
      "BUSINESS_PRECONDITION_FAILED",
    );
    expect(deps.repository.createCandidate).not.toHaveBeenCalled();
  });

  it("fixes action, target, risk and snapshot refs on the server", async () => {
    const deps = fakes();
    const result = await generateService(deps).execute(generateInput());
    expect(deps.repository.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        actorId: "actor-a",
        context: {
          subjectRef: { kind: "container", id: containerId },
          workRef: { kind: "node_task", id: taskId },
        },
        workOrderId,
        actionCode: "work_execution.claim_work_order",
        actionVersion: 1,
        riskLevel: "low",
        source: expect.objectContaining({
          kind: "rule",
          modelId: null,
          promptVersion: null,
          inputRefs: [
            { kind: "container", id: containerId, version: null },
            { kind: "node_task", id: taskId, version: 7 },
            { kind: "work_order", id: workOrderId, version: 3 },
          ],
        }),
      }),
    );
    expect(result).toMatchObject({
      actionCode: "work_execution.claim_work_order",
      workOrderId,
      riskLevel: "low",
      source: { kind: "rule" },
    });
  });

  it("uses an explicit fallback envelope when structured explanation fails", async () => {
    const deps = fakes();
    deps.explanation.explainTaskClaim.mockRejectedValue(new Error("timeout"));
    const result = await generateService(deps).execute(generateInput());
    expect(result.source).toMatchObject({
      kind: "fallback",
      modelId: null,
      promptVersion: null,
    });
    expect(result.warningCodes).toContain("explanation_fallback");
  });

  it("keeps model metadata only for a real validated model response", async () => {
    const deps = fakes();
    deps.explanation.explainTaskClaim.mockResolvedValue({
      kind: "model",
      rationale: "The current work order is ready and unassigned.",
      impact: "The current actor becomes responsible for this work order.",
      warningCodes: ["confirm_required"],
      modelId: "model-a",
      promptVersion: "claim-v1",
    });
    const result = await generateService(deps).execute(generateInput());
    expect(result.source).toMatchObject({
      kind: "model",
      modelId: "model-a",
      promptVersion: "claim-v1",
    });
  });

  it("hides get across tenant, actor and wrong task and derives terminal status", async () => {
    const deps = fakes();
    const service = new GetTaskActionCandidateService(
      deps.repository,
      deps.execution,
    );
    deps.repository.findCandidate.mockResolvedValueOnce(null);
    await expect(service.execute(getInput())).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    deps.repository.findCandidate.mockResolvedValueOnce(candidate());
    await expect(
      service.execute({ ...getInput(), taskId: crypto.randomUUID() }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    deps.repository.findCandidate.mockResolvedValueOnce({
      ...candidate(),
      decisions: [decision("rejected")],
    });
    await expect(service.execute(getInput())).resolves.toMatchObject({
      status: "rejected",
    });
  });

  it("projects expired without mutating a candidate when the snapshot drifts", async () => {
    const deps = fakes();
    deps.execution.resolve.mockResolvedValue({
      ...snapshot(),
      task: { ...snapshot().task, version: 8 },
    });
    const result = await new GetTaskActionCandidateService(
      deps.repository,
      deps.execution,
    ).execute(getInput());
    expect(result.status).toBe("expired");
    expect(deps.repository.createCandidate).not.toHaveBeenCalled();
  });

  it("rejects immutably with a stable semantic key and never calls claim", async () => {
    const deps = fakes();
    const result = await new RejectTaskActionCandidateService(
      deps.repository,
    ).execute(rejectInput());
    expect(deps.repository.appendDecisionWithLock).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId,
        decision: "rejected",
        idempotencyKey: expect.stringMatching(/^reject:/),
      }),
      expect.any(Function),
    );
    expect(deps.execution.claim).not.toHaveBeenCalled();
    expect(result).toMatchObject({ decision: "rejected", reason: "not now" });
  });

  it("maps hidden candidate and terminal conflicts to stable 404/409", async () => {
    const missing = fakes();
    missing.repository.appendDecisionWithLock.mockRejectedValue(
      new CandidateNotFoundError(),
    );
    await expect(
      new RejectTaskActionCandidateService(missing.repository).execute(
        rejectInput(),
      ),
    ).rejects.toMatchObject({ status: 404 });

    const decided = fakes();
    decided.repository.appendDecisionWithLock.mockRejectedValue(
      new CandidateDecisionConflictError(),
    );
    await expect(
      confirmService(decided).execute(confirmInput()),
    ).rejects.toMatchObject({ status: 409 });
    expect(decided.execution.claim).not.toHaveBeenCalled();
  });

  it("reauthorizes confirm and rejects a tampered candidate hash", async () => {
    const deps = fakes();
    const service = confirmService(deps);
    await expect(
      service.execute({
        ...confirmInput(),
        capabilities: ["task.read"],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.execute({
        ...confirmInput(),
        command: { ...confirmInput().command, candidateHash: "b".repeat(64) },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(deps.execution.claim).not.toHaveBeenCalled();
  });

  it("uses a server trace factory for the formal claim", async () => {
    const deps = fakes();
    await confirmService(deps).execute(confirmInput());
    expect(deps.execution.claim).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: "server-request-trace" }),
    );
  });

  it.each([
    ["task version", { task: { ...snapshot().task, version: 8 } }],
    [
      "work order state",
      { workOrder: { ...snapshot().workOrder, state: "blocked" } },
    ],
    [
      "assignee",
      { workOrder: { ...snapshot().workOrder, assigneeId: "actor-b" } },
    ],
    ["next action", { nextAction: null }],
  ])("rejects %s drift with zero claim", async (_name, override) => {
    const deps = fakes();
    deps.execution.resolve.mockResolvedValue({ ...snapshot(), ...override });
    await expect(
      confirmService(deps).execute(confirmInput()),
    ).rejects.toMatchObject({ status: 409 });
    expect(deps.execution.claim).not.toHaveBeenCalled();
  });

  it("links the accepted decision to the original claim receipt", async () => {
    const deps = fakes();
    deps.execution.claim.mockResolvedValue({
      ...claimResult(),
      traceId: "official-operation-trace",
    });
    const result = await confirmService(deps).execute(confirmInput());
    expect(deps.execution.claim).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "actor-a",
      workOrderId,
      idempotencyKey: "confirm-1",
      traceId: "server-request-trace",
    });
    expect(result).toMatchObject({
      contractVersion: "task-action-candidate-confirm-result.v1",
      decision: {
        decision: "accepted",
        clientOperationId: operationId,
        traceId: "official-operation-trace",
        executionState: "applied",
      },
      claimWorkOrderResult: {
        clientOperationId: operationId,
      },
    });
    expect(result.claimWorkOrderResult).not.toHaveProperty("traceId");
  });

  it("does not append accepted when the official claim rejects", async () => {
    const deps = fakes();
    deps.execution.claim.mockRejectedValue(
      new HttpException("BUSINESS_STATE_VIOLATION", 409),
    );
    await expect(confirmService(deps).execute(confirmInput())).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(deps.repository.__decisions).toHaveLength(0);
  });
});

function generateService(deps: ReturnType<typeof fakes>) {
  return new GenerateTaskActionCandidateService(
    deps.repository,
    deps.execution,
    deps.explanation,
    () => new Date("2026-10-20T01:00:00.000Z"),
    () => candidateId,
  );
}

function confirmService(deps: ReturnType<typeof fakes>) {
  return new ConfirmTaskActionCandidateService(
    deps.repository,
    deps.execution,
    () => "server-request-trace",
    () => new Date("2026-10-20T02:00:00.000Z"),
    () => "60000000-0000-4000-8000-000000000001",
  );
}

function fakes() {
  const decisions: unknown[] = [];
  const repository = {
    __decisions: decisions,
    createCandidate: vi.fn(async (value) => ({
      ...value,
      recordedAt: new Date(),
      decisions: [],
    })),
    findCandidate: vi.fn().mockResolvedValue(candidate()),
    appendDecision: vi.fn(),
    appendDecisionWithLock: vi.fn(async (input, build) => {
      const value = await build(candidate());
      decisions.push(value);
      return {
        decision: {
          ...value,
          candidateId,
          decidedByActorId: "actor-a",
          decidedAt: new Date(value.decidedAt),
          recordedAt: new Date(value.decidedAt),
        },
        idempotencyReplay: false,
      };
    }),
  };
  return {
    repository,
    execution: {
      resolve: vi.fn().mockResolvedValue(snapshot()),
      claim: vi.fn().mockResolvedValue(claimResult()),
      findClaimReceipt: vi.fn().mockResolvedValue(null),
    },
    explanation: {
      explainTaskClaim: vi.fn().mockResolvedValue({
        kind: "rule",
        rationale: "The current work order is ready and unassigned.",
        impact: "The current actor becomes responsible for this work order.",
        warningCodes: ["confirm_required"],
        modelId: null,
        promptVersion: null,
      }),
    },
  };
}

function snapshot() {
  return {
    tenantId: "tenant-a",
    subjectRef: { kind: "container" as const, id: containerId },
    task: {
      id: taskId,
      version: 7,
      state: "in_progress" as const,
      applicability: "required" as const,
      readinessState: "ready" as const,
    },
    workOrder: {
      id: workOrderId,
      version: 3,
      state: "ready" as const,
      applicability: "required" as const,
      assignmentState: "unassigned" as const,
      assigneeId: null,
    },
    nextAction: {
      actionCode: "work_execution.claim_work_order" as const,
      workOrderId,
    },
  };
}

function candidate() {
  return {
    candidateId,
    tenantId: "tenant-a",
    actorId: "actor-a",
    context: {
      subjectRef: { kind: "container" as const, id: containerId },
      workRef: { kind: "node_task" as const, id: taskId },
    },
    workOrderId,
    actionCode: "work_execution.claim_work_order" as const,
    actionVersion: 1 as const,
    title: "Claim current work order",
    rationale: "The current work order is ready and unassigned.",
    impact: "The current actor becomes responsible for this work order.",
    riskLevel: "low" as const,
    warningCodes: ["confirm_required"],
    status: "proposed" as const,
    candidateHash: "a".repeat(64),
    source: {
      kind: "rule" as const,
      capabilityId: "task.claim-assistance" as const,
      capabilityVersion: 1 as const,
      schemaVersion: 1 as const,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: taskClaimSnapshotHash(snapshot()),
      inputRefs: [
        { kind: "container" as const, id: containerId, version: null },
        { kind: "node_task" as const, id: taskId, version: 7 },
        { kind: "work_order" as const, id: workOrderId, version: 3 },
      ],
      generatedAt: new Date("2026-10-20T01:00:00.000Z"),
    },
    recordedAt: new Date("2026-10-20T01:00:00.000Z"),
    decisions: [],
  };
}

function decision(value: "accepted" | "rejected") {
  return {
    decisionId: "60000000-0000-4000-8000-000000000001",
    candidateId,
    decidedByActorId: "actor-a",
    decision: value,
    reason: value === "rejected" ? "not now" : null,
    idempotencyKey: "decision-1",
    decisionHash: "d".repeat(64),
    decidedAt: new Date("2026-10-20T02:00:00.000Z"),
    clientOperationId: value === "accepted" ? operationId : null,
    traceId: value === "accepted" ? "trace-a" : null,
    executionState: value === "accepted" ? ("applied" as const) : null,
    resultRefs: [],
    recordedAt: new Date("2026-10-20T02:00:00.000Z"),
  };
}

function claimResult() {
  return {
    workOrderId,
    workOrderState: "in_progress" as const,
    assignmentState: "assigned" as const,
    assigneeId: "actor-a",
    taskId,
    taskState: "in_progress" as const,
    applied: true,
    clientOperationId: operationId,
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
    traceId: "trace-a",
  };
}

function generateInput() {
  return {
    tenantId: "tenant-a",
    actorId: "actor-a",
    capabilities: ["task.read"],
    taskId,
    command: {
      contractVersion: "task-action-candidate-generate.v1" as const,
      subjectRef: { kind: "container" as const, id: containerId },
      workRef: { kind: "node_task" as const, id: taskId },
    },
  };
}

function getInput() {
  return {
    tenantId: "tenant-a",
    actorId: "actor-a",
    capabilities: ["task.read"],
    taskId,
    candidateId,
  };
}

function rejectInput() {
  return {
    ...getInput(),
    command: {
      contractVersion: "task-action-candidate-reject.v1" as const,
      candidateId,
      reason: " not now ",
    },
  };
}

function confirmInput() {
  return {
    ...getInput(),
    capabilities: ["task.read", "task.execute"],
    command: {
      contractVersion: "task-action-candidate-confirm.v1" as const,
      candidateId,
      candidateHash: "a".repeat(64),
      idempotencyKey: "confirm-1",
    },
  };
}
