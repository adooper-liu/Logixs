import { createHash } from "node:crypto";

export const TASK_ACTION_CODE = "work_execution.claim_work_order" as const;
export const TASK_ACTION_CAPABILITY = "task.claim-assistance" as const;
export const TASK_ACTION_VERSION = 1 as const;
export const TASK_ACTION_SCHEMA_VERSION = 1 as const;
export const TASK_ACTION_RISK = "low" as const;

export type TaskActionInputRefKind = "container" | "node_task" | "work_order";
export type TaskActionResultRefKind =
  TaskActionInputRefKind | "client_operation";
export type TaskActionSourceKind = "rule" | "model" | "fallback";
export type TaskActionCandidateStatus =
  "proposed" | "accepted" | "rejected" | "expired";
export type TaskActionDecision = "accepted" | "rejected";
export type TaskActionExecutionState = "pending" | "applied" | "failed";

export interface GenerateTaskActionCandidateCommand {
  contractVersion: "task-action-candidate-generate.v1";
  subjectRef: { kind: "container"; id: string };
  workRef: { kind: "node_task"; id: string };
}

export interface ConfirmTaskActionCandidateCommand {
  contractVersion: "task-action-candidate-confirm.v1";
  candidateId: string;
  candidateHash: string;
  idempotencyKey: string;
}

export interface RejectTaskActionCandidateCommand {
  contractVersion: "task-action-candidate-reject.v1";
  candidateId: string;
  reason?: string;
}

export interface TaskActionCandidateInput {
  candidateId: string;
  context: {
    subjectRef: { kind: "container"; id: string };
    workRef: { kind: "node_task"; id: string };
  };
  workOrderId: string;
  actionCode: typeof TASK_ACTION_CODE;
  actionVersion: typeof TASK_ACTION_VERSION;
  title: string;
  rationale: string;
  impact: string;
  riskLevel: typeof TASK_ACTION_RISK;
  warningCodes: readonly string[];
  status: TaskActionCandidateStatus;
  source: {
    kind: TaskActionSourceKind;
    capabilityId: typeof TASK_ACTION_CAPABILITY;
    capabilityVersion: 1;
    schemaVersion: typeof TASK_ACTION_SCHEMA_VERSION;
    promptVersion: string | null;
    modelId: string | null;
    inputSnapshotHash: string;
    inputRefs: readonly {
      kind: TaskActionInputRefKind;
      id: string;
      version: number | null;
    }[];
    generatedAt: string;
  };
}

export type NormalizedTaskActionCandidate = TaskActionCandidateInput & {
  warningCodes: string[];
  source: TaskActionCandidateInput["source"] & {
    inputRefs: Array<{
      kind: TaskActionInputRefKind;
      id: string;
      version: number | null;
    }>;
  };
  candidateHash: string;
};

export interface TaskActionDecisionInput {
  decisionId: string;
  decision: TaskActionDecision;
  reason?: string | null;
  idempotencyKey: string;
  decidedAt: string;
  clientOperationId: string | null;
  traceId: string | null;
  executionState: TaskActionExecutionState | null;
  resultRefs: readonly {
    kind: TaskActionResultRefKind;
    id: string;
    version: number | null;
  }[];
}

export type NormalizedTaskActionDecision = Omit<
  TaskActionDecisionInput,
  "reason" | "resultRefs"
> & {
  reason: string | null;
  resultRefs: Array<{
    kind: TaskActionResultRefKind;
    id: string;
    version: number | null;
  }>;
  decisionHash: string;
};

export class OpsAssistantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpsAssistantValidationError";
  }
}

export function normalizeGenerateTaskActionCandidateCommand(
  input: GenerateTaskActionCandidateCommand,
): GenerateTaskActionCandidateCommand {
  assertExactKeys(input, GENERATE_KEYS, "command");
  if (input.contractVersion !== "task-action-candidate-generate.v1") {
    invalid("VALIDATION_ENUM: contractVersion");
  }
  return {
    contractVersion: input.contractVersion,
    subjectRef: normalizeSubjectRef(input.subjectRef),
    workRef: normalizeWorkRef(input.workRef),
  };
}

export function normalizeConfirmTaskActionCandidateCommand(
  input: ConfirmTaskActionCandidateCommand,
): ConfirmTaskActionCandidateCommand {
  assertExactKeys(input, CONFIRM_KEYS, "command");
  if (input.contractVersion !== "task-action-candidate-confirm.v1") {
    invalid("VALIDATION_ENUM: contractVersion");
  }
  return {
    contractVersion: input.contractVersion,
    candidateId: uuid(input.candidateId, "candidateId"),
    candidateHash: hash(input.candidateHash, "candidateHash"),
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
  };
}

export function normalizeRejectTaskActionCandidateCommand(
  input: RejectTaskActionCandidateCommand,
): RejectTaskActionCandidateCommand {
  assertExactKeys(input, REJECT_KEYS, "command", REJECT_REQUIRED_KEYS);
  if (input.contractVersion !== "task-action-candidate-reject.v1") {
    invalid("VALIDATION_ENUM: contractVersion");
  }
  return {
    contractVersion: input.contractVersion,
    candidateId: uuid(input.candidateId, "candidateId"),
    ...(input.reason === undefined
      ? {}
      : { reason: text(input.reason, "reason", 500) }),
  };
}

export function normalizeTaskActionCandidate(
  input: TaskActionCandidateInput,
): NormalizedTaskActionCandidate {
  assertExactKeys(input, CANDIDATE_KEYS, "candidate");
  assertExactKeys(input.context, CONTEXT_KEYS, "context");
  assertExactKeys(input.source, SOURCE_KEYS, "source");
  if (input.actionCode !== TASK_ACTION_CODE)
    invalid("VALIDATION_ENUM: actionCode");
  if (input.actionVersion !== TASK_ACTION_VERSION) {
    invalid("VALIDATION_ENUM: actionVersion");
  }
  if (input.riskLevel !== TASK_ACTION_RISK)
    invalid("VALIDATION_ENUM: riskLevel");
  const status = candidateStatusValue(input.status);
  if (input.source.capabilityId !== TASK_ACTION_CAPABILITY) {
    invalid("VALIDATION_ENUM: source.capabilityId");
  }
  if (input.source.capabilityVersion !== 1) {
    invalid("VALIDATION_ENUM: source.capabilityVersion");
  }
  if (input.source.schemaVersion !== TASK_ACTION_SCHEMA_VERSION) {
    invalid("VALIDATION_ENUM: source.schemaVersion");
  }

  const sourceKind = sourceKindValue(input.source.kind);
  const promptVersion = nullableText(
    input.source.promptVersion,
    "source.promptVersion",
    100,
  );
  const modelId = nullableText(input.source.modelId, "source.modelId", 200);
  if (sourceKind === "model") {
    if (promptVersion === null || modelId === null) {
      invalid("VALIDATION_SOURCE: model metadata required");
    }
  } else if (promptVersion !== null || modelId !== null) {
    invalid("VALIDATION_SOURCE: non-model metadata forbidden");
  }

  const normalizedWithoutHash = {
    candidateId: uuid(input.candidateId, "candidateId"),
    context: {
      subjectRef: normalizeSubjectRef(input.context.subjectRef),
      workRef: normalizeWorkRef(input.context.workRef),
    },
    workOrderId: uuid(input.workOrderId, "workOrderId"),
    actionCode: TASK_ACTION_CODE,
    actionVersion: TASK_ACTION_VERSION,
    title: text(input.title, "title", 200),
    rationale: text(input.rationale, "rationale", 4_000),
    impact: text(input.impact, "impact", 4_000),
    riskLevel: TASK_ACTION_RISK,
    warningCodes: uniqueCodes(input.warningCodes, "warningCodes"),
    status,
    source: {
      kind: sourceKind,
      capabilityId: TASK_ACTION_CAPABILITY,
      capabilityVersion: 1 as const,
      schemaVersion: TASK_ACTION_SCHEMA_VERSION,
      promptVersion,
      modelId,
      inputSnapshotHash: hash(
        input.source.inputSnapshotHash,
        "source.inputSnapshotHash",
      ),
      inputRefs: normalizeInputRefs(input.source.inputRefs),
      generatedAt: dateTime(input.source.generatedAt, "source.generatedAt"),
    },
  };

  return {
    ...normalizedWithoutHash,
    candidateHash: sha256({
      context: normalizedWithoutHash.context,
      workOrderId: normalizedWithoutHash.workOrderId,
      actionCode: normalizedWithoutHash.actionCode,
      actionVersion: normalizedWithoutHash.actionVersion,
      title: normalizedWithoutHash.title,
      rationale: normalizedWithoutHash.rationale,
      impact: normalizedWithoutHash.impact,
      riskLevel: normalizedWithoutHash.riskLevel,
      warningCodes: normalizedWithoutHash.warningCodes,
      source: {
        kind: normalizedWithoutHash.source.kind,
        capabilityId: normalizedWithoutHash.source.capabilityId,
        capabilityVersion: normalizedWithoutHash.source.capabilityVersion,
        schemaVersion: normalizedWithoutHash.source.schemaVersion,
        promptVersion: normalizedWithoutHash.source.promptVersion,
        modelId: normalizedWithoutHash.source.modelId,
        inputSnapshotHash: normalizedWithoutHash.source.inputSnapshotHash,
        inputRefs: normalizedWithoutHash.source.inputRefs,
      },
    }),
  };
}

export function normalizeTaskActionDecision(
  input: TaskActionDecisionInput,
): NormalizedTaskActionDecision {
  assertExactKeys(input, DECISION_KEYS, "decision", DECISION_REQUIRED_KEYS);
  const decision = decisionValue(input.decision);
  const reason =
    input.reason === undefined || input.reason === null
      ? null
      : text(input.reason, "reason", 500);
  const clientOperationId = nullableText(
    input.clientOperationId,
    "clientOperationId",
    128,
  );
  const traceId = nullableText(input.traceId, "traceId", 128);
  const executionState = executionStateValue(input.executionState);
  const resultRefs = normalizeTypedRefs(
    input.resultRefs,
    RESULT_REF_KINDS,
    "resultRefs",
  );

  assertDecisionLinks({
    decision,
    clientOperationId,
    executionState,
    resultRefs,
  });

  const normalizedWithoutHash = {
    decisionId: uuid(input.decisionId, "decisionId"),
    decision,
    reason,
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
    decidedAt: dateTime(input.decidedAt, "decidedAt"),
    clientOperationId,
    traceId,
    executionState,
    resultRefs,
  };
  return {
    ...normalizedWithoutHash,
    decisionHash: sha256({
      decision: normalizedWithoutHash.decision,
      reason: normalizedWithoutHash.reason,
      idempotencyKey: normalizedWithoutHash.idempotencyKey,
      clientOperationId: normalizedWithoutHash.clientOperationId,
      executionState: normalizedWithoutHash.executionState,
      resultRefs: normalizedWithoutHash.resultRefs,
    }),
  };
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeSubjectRef(value: { kind: "container"; id: string }) {
  assertExactKeys(value, REF_KEYS, "subjectRef");
  if (value.kind !== "container") invalid("VALIDATION_ENUM: subjectRef.kind");
  return { kind: "container" as const, id: uuid(value.id, "subjectRef.id") };
}

function normalizeWorkRef(value: { kind: "node_task"; id: string }) {
  assertExactKeys(value, REF_KEYS, "workRef");
  if (value.kind !== "node_task") invalid("VALIDATION_ENUM: workRef.kind");
  return { kind: "node_task" as const, id: uuid(value.id, "workRef.id") };
}

function normalizeInputRefs(
  values: TaskActionCandidateInput["source"]["inputRefs"],
) {
  return normalizeTypedRefs(values, INPUT_REF_KINDS, "source.inputRefs");
}

function normalizeTypedRefs<TKind extends string>(
  values: readonly {
    kind: TKind;
    id: string;
    version: number | null;
  }[],
  allowedKinds: ReadonlySet<string>,
  field: string,
) {
  if (!Array.isArray(values) || values.length > 20) {
    invalid(`VALIDATION_RANGE: ${field}`);
  }
  const normalized = values.map((value) => {
    assertExactKeys(value, INPUT_REF_KEYS, `${field}[]`);
    if (!allowedKinds.has(value.kind)) {
      invalid(`VALIDATION_ENUM: ${field}[].kind`);
    }
    if (
      value.version !== null &&
      (!Number.isInteger(value.version) || value.version < 0)
    ) {
      invalid(`VALIDATION_RANGE: ${field}[].version`);
    }
    return {
      kind: value.kind,
      id: uuid(value.id, `${field}[].id`),
      version: value.version,
    };
  });
  return [
    ...new Map(
      normalized.map((ref) => [
        `${ref.kind}\u0000${ref.id}\u0000${ref.version ?? ""}`,
        ref,
      ]),
    ).values(),
  ].sort((left, right) =>
    `${left.kind}\u0000${left.id}\u0000${left.version ?? ""}`.localeCompare(
      `${right.kind}\u0000${right.id}\u0000${right.version ?? ""}`,
    ),
  );
}

function assertDecisionLinks(input: {
  decision: TaskActionDecision;
  clientOperationId: string | null;
  executionState: TaskActionExecutionState | null;
  resultRefs: Array<{
    kind: TaskActionResultRefKind;
    id: string;
    version: number | null;
  }>;
}): void {
  const operationRefs = input.resultRefs.filter(
    (ref) => ref.kind === "client_operation",
  );
  if (input.decision === "rejected") {
    if (
      input.clientOperationId !== null ||
      input.executionState !== null ||
      input.resultRefs.length > 0
    ) {
      invalid("VALIDATION_DECISION_LINKS: rejected");
    }
    return;
  }
  if (input.clientOperationId === null) {
    if (
      input.executionState === "applied" ||
      input.executionState === "failed" ||
      operationRefs.length > 0
    ) {
      invalid("VALIDATION_DECISION_LINKS: clientOperationId");
    }
    return;
  }
  if (input.executionState === null) {
    invalid("VALIDATION_DECISION_LINKS: executionState");
  }
  if (operationRefs.some((ref) => ref.id !== input.clientOperationId)) {
    invalid("VALIDATION_DECISION_LINKS: resultRefs");
  }
}

function uniqueCodes(values: readonly string[], field: string): string[] {
  if (!Array.isArray(values) || values.length > 20) {
    invalid(`VALIDATION_RANGE: ${field}`);
  }
  return [
    ...new Set(
      values.map((value) => {
        const normalized = text(value, field, 100);
        if (!/^[a-z][a-z0-9_.-]*$/.test(normalized)) {
          invalid(`VALIDATION_FORMAT: ${field}`);
        }
        return normalized;
      }),
    ),
  ].sort();
}

function sourceKindValue(value: unknown): TaskActionSourceKind {
  if (value !== "rule" && value !== "model" && value !== "fallback") {
    invalid("VALIDATION_ENUM: source.kind");
  }
  return value;
}

function candidateStatusValue(value: unknown): TaskActionCandidateStatus {
  if (!CANDIDATE_STATUSES.has(value as TaskActionCandidateStatus)) {
    invalid("VALIDATION_ENUM: status");
  }
  return value as TaskActionCandidateStatus;
}

function decisionValue(value: unknown): TaskActionDecision {
  if (value !== "accepted" && value !== "rejected") {
    invalid("VALIDATION_ENUM: decision");
  }
  return value;
}

function executionStateValue(value: unknown): TaskActionExecutionState | null {
  if (value === null) return null;
  if (!EXECUTION_STATES.has(value as TaskActionExecutionState)) {
    invalid("VALIDATION_ENUM: executionState");
  }
  return value as TaskActionExecutionState;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(`VALIDATION_FORMAT: ${field}`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    invalid(`VALIDATION_RANGE: ${field}`);
  }
  return normalized;
}

function nullableText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  return value === null ? null : text(value, field, maxLength);
}

function uuid(value: unknown, field: string): string {
  const normalized = text(value, field, 36).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) invalid(`VALIDATION_FORMAT: ${field}`);
  return normalized;
}

function hash(value: unknown, field: string): string {
  const normalized = text(value, field, 64);
  if (!HASH_PATTERN.test(normalized)) invalid(`VALIDATION_FORMAT: ${field}`);
  return normalized;
}

function dateTime(value: unknown, field: string): string {
  const normalized = text(value, field, 40);
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) {
    invalid(`VALIDATION_FORMAT: ${field}`);
  }
  return normalized;
}

function assertExactKeys<T>(
  value: T,
  expectedKeys: ReadonlySet<string>,
  field: string,
  requiredKeys: ReadonlySet<string> = expectedKeys,
): asserts value is T & Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`VALIDATION_FORMAT: ${field}`);
  }
  for (const key of Object.keys(value)) {
    if (!expectedKeys.has(key)) invalid(`VALIDATION_FORBIDDEN: ${key}`);
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) invalid(`VALIDATION_REQUIRED: ${key}`);
  }
}

function invalid(message: string): never {
  throw new OpsAssistantValidationError(message);
}

const GENERATE_KEYS = new Set(["contractVersion", "subjectRef", "workRef"]);
const CONFIRM_KEYS = new Set([
  "contractVersion",
  "candidateId",
  "candidateHash",
  "idempotencyKey",
]);
const REJECT_KEYS = new Set(["contractVersion", "candidateId", "reason"]);
const REJECT_REQUIRED_KEYS = new Set(["contractVersion", "candidateId"]);
const CANDIDATE_KEYS = new Set([
  "candidateId",
  "context",
  "workOrderId",
  "actionCode",
  "actionVersion",
  "title",
  "rationale",
  "impact",
  "riskLevel",
  "warningCodes",
  "status",
  "source",
]);
const CONTEXT_KEYS = new Set(["subjectRef", "workRef"]);
const SOURCE_KEYS = new Set([
  "kind",
  "capabilityId",
  "capabilityVersion",
  "schemaVersion",
  "promptVersion",
  "modelId",
  "inputSnapshotHash",
  "inputRefs",
  "generatedAt",
]);
const DECISION_KEYS = new Set([
  "decisionId",
  "decision",
  "reason",
  "idempotencyKey",
  "decidedAt",
  "clientOperationId",
  "traceId",
  "executionState",
  "resultRefs",
]);
const DECISION_REQUIRED_KEYS = new Set(
  [...DECISION_KEYS].filter((key) => key !== "reason"),
);
const REF_KEYS = new Set(["kind", "id"]);
const INPUT_REF_KEYS = new Set(["kind", "id", "version"]);
const INPUT_REF_KINDS = new Set<TaskActionInputRefKind>([
  "container",
  "node_task",
  "work_order",
]);
const RESULT_REF_KINDS = new Set<TaskActionResultRefKind>([
  ...INPUT_REF_KINDS,
  "client_operation",
]);
const CANDIDATE_STATUSES = new Set<TaskActionCandidateStatus>([
  "proposed",
  "accepted",
  "rejected",
  "expired",
]);
const EXECUTION_STATES = new Set<TaskActionExecutionState>([
  "pending",
  "applied",
  "failed",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
