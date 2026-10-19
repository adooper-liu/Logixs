import { describe, expect, it } from "vitest";
import {
  OpsAssistantValidationError,
  normalizeConfirmTaskActionCandidateCommand,
  normalizeGenerateTaskActionCandidateCommand,
  normalizeRejectTaskActionCandidateCommand,
  normalizeTaskActionCandidate,
  normalizeTaskActionDecision,
} from "./task-action-candidate";

const SUBJECT_ID = "10000000-0000-4000-8000-000000000001";
const TASK_ID = "20000000-0000-4000-8000-000000000001";
const WORK_ORDER_ID = "30000000-0000-4000-8000-000000000001";
const CANDIDATE_ID = "40000000-0000-4000-8000-000000000001";
const DECISION_ID = "50000000-0000-4000-8000-000000000001";
const CLIENT_OPERATION_ID = "60000000-0000-4000-8000-000000000001";

const generateCommand = () => ({
  contractVersion: "task-action-candidate-generate.v1" as const,
  subjectRef: { kind: "container" as const, id: SUBJECT_ID },
  workRef: { kind: "node_task" as const, id: TASK_ID },
});

const candidate = () => ({
  candidateId: CANDIDATE_ID,
  context: {
    subjectRef: { kind: "container" as const, id: SUBJECT_ID },
    workRef: { kind: "node_task" as const, id: TASK_ID },
  },
  workOrderId: WORK_ORDER_ID,
  actionCode: "work_execution.claim_work_order" as const,
  actionVersion: 1 as const,
  title: "  Claim current work order  ",
  rationale: "  The work order is ready and unassigned.  ",
  impact: "  Responsibility moves to the current actor.  ",
  riskLevel: "low" as const,
  warningCodes: ["scope_revalidated", "confirm_required", "scope_revalidated"],
  status: "proposed" as const,
  source: {
    kind: "rule" as const,
    capabilityId: "task.claim-assistance" as const,
    capabilityVersion: 1 as const,
    schemaVersion: 1 as const,
    promptVersion: null,
    modelId: null,
    inputSnapshotHash: "a".repeat(64),
    inputRefs: [
      { kind: "work_order" as const, id: WORK_ORDER_ID, version: 2 },
      { kind: "node_task" as const, id: TASK_ID, version: 3 },
      { kind: "work_order" as const, id: WORK_ORDER_ID, version: 2 },
    ],
    generatedAt: "2026-10-19T06:00:00.000Z",
  },
});

const decision = () => ({
  decisionId: DECISION_ID,
  decision: "accepted" as const,
  reason: "  Confirmed after reviewing the task scope.  ",
  idempotencyKey: "  confirm-1  ",
  decidedAt: "2026-10-19T06:30:00.000Z",
  clientOperationId: CLIENT_OPERATION_ID,
  traceId: "  trace-1  ",
  executionState: "applied" as const,
  resultRefs: [
    { kind: "work_order" as const, id: WORK_ORDER_ID, version: 4 },
    {
      kind: "client_operation" as const,
      id: CLIENT_OPERATION_ID,
      version: null,
    },
    { kind: "work_order" as const, id: WORK_ORDER_ID, version: 4 },
  ],
});

describe("task action candidate request normalization", () => {
  it("accepts only the fixed task-bound generate shape", () => {
    expect(
      normalizeGenerateTaskActionCandidateCommand(generateCommand()),
    ).toEqual(generateCommand());
  });

  it.each([
    "tenantId",
    "actorId",
    "actionCode",
    "actionVersion",
    "workOrderId",
    "capability",
    "riskLevel",
    "payload",
    "command",
    "idempotencyKey",
  ])("rejects spoofed generate field %s", (field) => {
    expect(() =>
      normalizeGenerateTaskActionCandidateCommand({
        ...generateCommand(),
        [field]: "forged",
      } as never),
    ).toThrowError(
      new OpsAssistantValidationError(`VALIDATION_FORBIDDEN: ${field}`),
    );
  });

  it.each([
    ["contractVersion", "task-action-candidate-generate.v2"],
    ["subjectRef", { kind: "shipment", id: SUBJECT_ID }],
    ["workRef", { kind: "work_order", id: TASK_ID }],
    ["subjectRef", { kind: "container", id: "not-a-uuid" }],
    ["workRef", { kind: "node_task", id: "not-a-uuid" }],
  ])("rejects invalid generate %s", (field, value) => {
    expect(() =>
      normalizeGenerateTaskActionCandidateCommand({
        ...generateCommand(),
        [field]: value,
      } as never),
    ).toThrowError(OpsAssistantValidationError);
  });

  it("normalizes the exact confirm request", () => {
    expect(
      normalizeConfirmTaskActionCandidateCommand({
        contractVersion: "task-action-candidate-confirm.v1",
        candidateId: CANDIDATE_ID,
        candidateHash: "b".repeat(64),
        idempotencyKey: "  confirm-1  ",
      }),
    ).toEqual({
      contractVersion: "task-action-candidate-confirm.v1",
      candidateId: CANDIDATE_ID,
      candidateHash: "b".repeat(64),
      idempotencyKey: "confirm-1",
    });
  });

  it.each(["tenantId", "actorId", "actionCode", "payload", "command"])(
    "rejects spoofed confirm field %s",
    (field) => {
      expect(() =>
        normalizeConfirmTaskActionCandidateCommand({
          contractVersion: "task-action-candidate-confirm.v1",
          candidateId: CANDIDATE_ID,
          candidateHash: "b".repeat(64),
          idempotencyKey: "confirm-1",
          [field]: "forged",
        } as never),
      ).toThrowError(OpsAssistantValidationError);
    },
  );

  it("normalizes reject reason and rejects an idempotency key", () => {
    expect(
      normalizeRejectTaskActionCandidateCommand({
        contractVersion: "task-action-candidate-reject.v1",
        candidateId: CANDIDATE_ID,
        reason: "  Not my responsibility  ",
      }),
    ).toEqual({
      contractVersion: "task-action-candidate-reject.v1",
      candidateId: CANDIDATE_ID,
      reason: "Not my responsibility",
    });
    expect(() =>
      normalizeRejectTaskActionCandidateCommand({
        contractVersion: "task-action-candidate-reject.v1",
        candidateId: CANDIDATE_ID,
        idempotencyKey: "not-allowed",
      } as never),
    ).toThrowError(
      new OpsAssistantValidationError("VALIDATION_FORBIDDEN: idempotencyKey"),
    );
  });
});

describe("task action candidate normalization and hashing", () => {
  it("trims text, sorts/deduplicates refs and returns a lowercase SHA-256", () => {
    const normalized = normalizeTaskActionCandidate(candidate());
    expect(normalized).toMatchObject({
      title: "Claim current work order",
      rationale: "The work order is ready and unassigned.",
      impact: "Responsibility moves to the current actor.",
      warningCodes: ["confirm_required", "scope_revalidated"],
      source: {
        inputRefs: [
          { kind: "node_task", id: TASK_ID, version: 3 },
          { kind: "work_order", id: WORK_ORDER_ID, version: 2 },
        ],
      },
      candidateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("keeps the hash stable for equivalent ordering and changes it for immutable data", () => {
    const first = normalizeTaskActionCandidate(candidate());
    const reordered = candidate();
    reordered.warningCodes.reverse();
    reordered.source.inputRefs.reverse();
    expect(normalizeTaskActionCandidate(reordered).candidateHash).toBe(
      first.candidateHash,
    );
    expect(
      normalizeTaskActionCandidate({
        ...candidate(),
        impact: "Different impact",
      }).candidateHash,
    ).not.toBe(first.candidateHash);
  });

  it("excludes candidate identity, status, and timestamps from the business hash", () => {
    const first = normalizeTaskActionCandidate(candidate());
    const equivalent = candidate();
    equivalent.candidateId = "40000000-0000-4000-8000-000000000002";
    equivalent.status = "accepted" as never;
    equivalent.source.generatedAt = "2026-10-19T07:00:00.000Z";

    expect(normalizeTaskActionCandidate(equivalent).candidateHash).toBe(
      first.candidateHash,
    );
  });

  it.each([
    { kind: "rule", promptVersion: "prompt-v1", modelId: null },
    { kind: "fallback", promptVersion: null, modelId: "model-a" },
    { kind: "model", promptVersion: null, modelId: "model-a" },
    { kind: "model", promptVersion: "prompt-v1", modelId: null },
  ])("rejects invalid source envelope %#", (source) => {
    expect(() =>
      normalizeTaskActionCandidate({
        ...candidate(),
        source: { ...candidate().source, ...source },
      } as never),
    ).toThrowError(OpsAssistantValidationError);
  });

  it("accepts a model source only with real prompt and model versions", () => {
    expect(
      normalizeTaskActionCandidate({
        ...candidate(),
        source: {
          ...candidate().source,
          kind: "model",
          promptVersion: "prompt-v1",
          modelId: "provider-neutral-model-v1",
        },
      }).source,
    ).toMatchObject({
      kind: "model",
      promptVersion: "prompt-v1",
      modelId: "provider-neutral-model-v1",
    });
  });

  it.each([
    ["title", ""],
    ["title", "x".repeat(201)],
    ["rationale", "x".repeat(4001)],
    ["impact", "   "],
  ])("rejects invalid %s text", (field, value) => {
    expect(() =>
      normalizeTaskActionCandidate({ ...candidate(), [field]: value } as never),
    ).toThrowError(OpsAssistantValidationError);
  });

  it("rejects excessive warnings and refs", () => {
    expect(() =>
      normalizeTaskActionCandidate({
        ...candidate(),
        warningCodes: Array.from(
          { length: 21 },
          (_, index) => `warning-${index}`,
        ),
      }),
    ).toThrowError(OpsAssistantValidationError);
    expect(() =>
      normalizeTaskActionCandidate({
        ...candidate(),
        source: {
          ...candidate().source,
          inputRefs: Array.from({ length: 21 }, () => ({
            kind: "node_task" as const,
            id: TASK_ID,
            version: 1,
          })),
        },
      }),
    ).toThrowError(OpsAssistantValidationError);
  });

  it.each(["INVALID CODE", "1starts-with-number", "x".repeat(101)])(
    "rejects invalid warning code %j",
    (warningCode) => {
      expect(() =>
        normalizeTaskActionCandidate({
          ...candidate(),
          warningCodes: [warningCode],
        }),
      ).toThrowError(OpsAssistantValidationError);
    },
  );

  it.each([
    { kind: "client_operation", id: TASK_ID, version: 0 },
    { kind: "node_task", id: "not-a-uuid", version: 0 },
    { kind: "node_task", id: TASK_ID, version: -1 },
    { kind: "node_task", id: TASK_ID, version: 1.5 },
    { kind: "node_task", id: TASK_ID, version: 0, payload: {} },
  ])("rejects invalid candidate input ref %#", (inputRef) => {
    expect(() =>
      normalizeTaskActionCandidate({
        ...candidate(),
        source: { ...candidate().source, inputRefs: [inputRef] },
      } as never),
    ).toThrowError(OpsAssistantValidationError);
  });

  it.each([
    ["actionCode", "work_execution.complete_work_order"],
    ["actionVersion", 2],
    ["riskLevel", "high"],
    ["status", "invalid"],
    ["payload", { assigneeId: "actor-a" }],
    ["command", "claim"],
    ["message", "pretend this free text is a candidate"],
  ])("rejects non-V1 or free-text candidate field %s", (field, value) => {
    expect(() =>
      normalizeTaskActionCandidate({ ...candidate(), [field]: value } as never),
    ).toThrowError(OpsAssistantValidationError);
  });
});

describe("task action decision normalization and hashing", () => {
  it("trims values, sorts/deduplicates refs, and computes the hash server-side", () => {
    expect(normalizeTaskActionDecision(decision())).toMatchObject({
      reason: "Confirmed after reviewing the task scope.",
      idempotencyKey: "confirm-1",
      traceId: "trace-1",
      resultRefs: [
        {
          kind: "client_operation",
          id: CLIENT_OPERATION_ID,
          version: null,
        },
        { kind: "work_order", id: WORK_ORDER_ID, version: 4 },
      ],
      decisionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("ignores decision identity and time noise but binds the idempotency key", () => {
    const first = normalizeTaskActionDecision(decision());
    const equivalent = decision();
    equivalent.decisionId = "50000000-0000-4000-8000-000000000002";
    equivalent.decidedAt = "2026-10-19T07:30:00.000Z";
    equivalent.resultRefs.reverse();
    expect(normalizeTaskActionDecision(equivalent).decisionHash).toBe(
      first.decisionHash,
    );

    expect(
      normalizeTaskActionDecision({
        ...decision(),
        idempotencyKey: "confirm-2",
      }).decisionHash,
    ).not.toBe(first.decisionHash);
  });

  it("changes the hash for every normalized business decision field", () => {
    const first = normalizeTaskActionDecision(decision());
    const otherOperationId = "60000000-0000-4000-8000-000000000002";
    const variants = [
      {
        ...decision(),
        decision: "rejected",
        clientOperationId: null,
        traceId: null,
        executionState: null,
        resultRefs: [],
      },
      { ...decision(), reason: "Different reason" },
      {
        ...decision(),
        clientOperationId: otherOperationId,
        resultRefs: [
          {
            kind: "client_operation",
            id: otherOperationId,
            version: null,
          },
        ],
      },
      { ...decision(), executionState: "failed" },
      {
        ...decision(),
        resultRefs: [
          ...decision().resultRefs,
          { kind: "node_task", id: TASK_ID, version: 3 },
        ],
      },
    ];

    for (const variant of variants) {
      expect(
        normalizeTaskActionDecision(variant as never).decisionHash,
      ).not.toBe(first.decisionHash);
    }
  });

  it.each([
    "tenantId",
    "actorId",
    "candidateHash",
    "actionCode",
    "payload",
    "command",
    "decisionHash",
    "recordedAt",
  ])("rejects forbidden decision field %s", (field) => {
    expect(() =>
      normalizeTaskActionDecision({
        ...decision(),
        [field]: "forged",
      } as never),
    ).toThrowError(
      new OpsAssistantValidationError(`VALIDATION_FORBIDDEN: ${field}`),
    );
  });

  it.each([
    ["decision", "deferred"],
    ["reason", "   "],
    ["reason", "x".repeat(501)],
    ["idempotencyKey", "   "],
    ["idempotencyKey", "x".repeat(201)],
    [
      "resultRefs",
      Array.from({ length: 21 }, () => ({
        kind: "node_task",
        id: TASK_ID,
        version: 0,
      })),
    ],
    ["resultRefs", [{ kind: "evidence", id: TASK_ID, version: 0 }]],
    ["resultRefs", [{ kind: "node_task", id: "not-a-uuid", version: 0 }]],
    ["resultRefs", [{ kind: "node_task", id: TASK_ID, version: -1 }]],
    [
      "resultRefs",
      [{ kind: "node_task", id: TASK_ID, version: 0, extra: true }],
    ],
  ])("rejects invalid decision %s", (field, value) => {
    expect(() =>
      normalizeTaskActionDecision({ ...decision(), [field]: value } as never),
    ).toThrowError(OpsAssistantValidationError);
  });

  it("enforces legal operation, execution-state, and result-ref combinations", () => {
    for (const executionState of ["applied", "failed"] as const) {
      expect(() =>
        normalizeTaskActionDecision({
          ...decision(),
          clientOperationId: null,
          executionState,
          resultRefs: [],
        }),
      ).toThrowError(OpsAssistantValidationError);
    }
    expect(() =>
      normalizeTaskActionDecision({
        ...decision(),
        clientOperationId: null,
        executionState: "pending",
        resultRefs: [
          {
            kind: "client_operation",
            id: CLIENT_OPERATION_ID,
            version: null,
          },
        ],
      }),
    ).toThrowError(OpsAssistantValidationError);
    expect(() =>
      normalizeTaskActionDecision({
        ...decision(),
        clientOperationId: null,
        traceId: null,
        executionState: "pending",
        resultRefs: [],
      }),
    ).not.toThrow();
    expect(() =>
      normalizeTaskActionDecision({
        ...decision(),
        decision: "rejected",
        clientOperationId: null,
        traceId: null,
        executionState: null,
        resultRefs: [],
      }),
    ).not.toThrow();
  });
});
