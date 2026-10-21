import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import type {
  TaskActionCandidateV1,
  TaskActionConfirmResultV1,
  TaskActionDecisionV1,
} from "@logix/contracts";
import {
  TASK_CLAIM_EXPLANATION,
  type TaskClaimExplanationPort,
} from "../../ai-governance";
import {
  TASK_ASSISTANT_CLAIM_EXECUTION,
  type TaskAssistantClaimExecutionPort,
  type TaskAssistantClaimResult,
  type TaskAssistantClaimSnapshot,
} from "../../work-execution";
import {
  normalizeConfirmTaskActionCandidateCommand,
  normalizeGenerateTaskActionCandidateCommand,
  normalizeRejectTaskActionCandidateCommand,
  normalizeTaskActionCandidate,
  normalizeTaskActionDecision,
  OpsAssistantValidationError,
  sha256,
  TASK_ACTION_CAPABILITY,
  TASK_ACTION_CODE,
  TASK_ACTION_RISK,
  TASK_ACTION_SCHEMA_VERSION,
  TASK_ACTION_VERSION,
  type ConfirmTaskActionCandidateCommand,
  type GenerateTaskActionCandidateCommand,
  type RejectTaskActionCandidateCommand,
} from "../domain/task-action-candidate";
import {
  CandidateDecisionConflictError,
  CandidateNotFoundError,
  TASK_ACTION_CANDIDATE_REPOSITORY,
  type TaskActionCandidateRecord,
  type TaskActionCandidateRepository,
  type TaskActionDecisionRecord,
} from "../domain/task-action-candidate.repository";

const TASK_ACTION_NOW = Symbol("TaskActionNow");
const TASK_ACTION_ID_FACTORY = Symbol("TaskActionIdFactory");
export const TASK_ACTION_TRACE_FACTORY = Symbol("TaskActionTraceFactory");
export const TASK_CLAIM_COPY = {
  title: "建议领取当前工单",
  rationale: "当前工单处于可领取且未分配状态。",
  impact:
    "确认后由服务端重新校验并将当前工单分配给你；未确认不会改变任务状态。",
} as const;

interface RequestScope {
  tenantId: string;
  actorId: string;
  capabilities: readonly string[];
  taskId: string;
}

@Injectable()
export class GenerateTaskActionCandidateService {
  constructor(
    @Inject(TASK_ACTION_CANDIDATE_REPOSITORY)
    private readonly repository: TaskActionCandidateRepository,
    @Inject(TASK_ASSISTANT_CLAIM_EXECUTION)
    private readonly execution: TaskAssistantClaimExecutionPort,
    @Inject(TASK_CLAIM_EXPLANATION)
    private readonly explanation: TaskClaimExplanationPort,
    @Optional()
    @Inject(TASK_ACTION_NOW)
    private readonly now: () => Date = () => new Date(),
    @Optional()
    @Inject(TASK_ACTION_ID_FACTORY)
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(
    input: RequestScope & { command: GenerateTaskActionCandidateCommand },
  ): Promise<TaskActionCandidateV1> {
    requireCapabilities(input.capabilities, "task.read");
    const command = normalizeClientCommand(() =>
      normalizeGenerateTaskActionCandidateCommand(input.command),
    );
    const taskId = uuidPath(input.taskId, "taskId");
    if (taskId !== command.workRef.id) badRequest("TASK_PATH_MISMATCH");
    const snapshot = await this.execution.resolve({
      tenantId: input.tenantId,
      taskId,
      subjectRef: command.subjectRef,
    });
    if (!snapshot) notFound();
    assertClaimableSnapshot(snapshot);
    const workOrder = snapshot.workOrder!;
    const generatedAt = this.now();
    let explanation;
    try {
      explanation = await this.explanation.explainTaskClaim({
        taskId: snapshot.task.id,
        workOrderId: workOrder.id,
        taskState: snapshot.task.state,
        workOrderState: workOrder.state,
        assignmentState: workOrder.assignmentState,
        assigneeId: workOrder.assigneeId,
      });
    } catch {
      explanation = fallbackExplanation();
    }

    const normalized = normalizeTaskActionCandidate({
      candidateId: this.newId(),
      context: { subjectRef: command.subjectRef, workRef: command.workRef },
      workOrderId: workOrder.id,
      actionCode: TASK_ACTION_CODE,
      actionVersion: TASK_ACTION_VERSION,
      title: TASK_CLAIM_COPY.title,
      rationale: explanation.rationale,
      impact: explanation.impact,
      riskLevel: TASK_ACTION_RISK,
      warningCodes: explanation.warningCodes,
      status: "proposed",
      source: {
        kind: explanation.kind,
        capabilityId: TASK_ACTION_CAPABILITY,
        capabilityVersion: 1,
        schemaVersion: TASK_ACTION_SCHEMA_VERSION,
        promptVersion: explanation.promptVersion,
        modelId: explanation.modelId,
        inputSnapshotHash: taskClaimSnapshotHash(snapshot),
        inputRefs: snapshotRefs(snapshot),
        generatedAt: generatedAt.toISOString(),
      },
    });
    const stored = await mapRepositoryErrors(() =>
      this.repository.createCandidate({
        ...normalized,
        tenantId: input.tenantId,
        actorId: input.actorId,
        status: "proposed",
        source: { ...normalized.source, generatedAt },
      }),
    );
    return candidateResponse(stored, "proposed");
  }
}

@Injectable()
export class GetTaskActionCandidateService {
  constructor(
    @Inject(TASK_ACTION_CANDIDATE_REPOSITORY)
    private readonly repository: TaskActionCandidateRepository,
    @Inject(TASK_ASSISTANT_CLAIM_EXECUTION)
    private readonly execution: TaskAssistantClaimExecutionPort,
  ) {}

  async execute(
    input: RequestScope & { candidateId: string },
  ): Promise<TaskActionCandidateV1> {
    requireCapabilities(input.capabilities, "task.read");
    const candidate = await findScopedCandidate(this.repository, {
      ...input,
      taskId: uuidPath(input.taskId, "taskId"),
      candidateId: uuidPath(input.candidateId, "candidateId"),
    });
    const terminal = candidate.decisions[0]?.decision;
    if (terminal) return candidateResponse(candidate, terminal);
    const snapshot = await resolveCandidateSnapshot(this.execution, candidate);
    if (!snapshot) notFound();
    const status = snapshotMatches(candidate, snapshot)
      ? "proposed"
      : "expired";
    return candidateResponse(candidate, status);
  }
}

@Injectable()
export class RejectTaskActionCandidateService {
  constructor(
    @Inject(TASK_ACTION_CANDIDATE_REPOSITORY)
    private readonly repository: TaskActionCandidateRepository,
    @Optional()
    @Inject(TASK_ACTION_NOW)
    private readonly now: () => Date = () => new Date(),
    @Optional()
    @Inject(TASK_ACTION_ID_FACTORY)
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(
    input: RequestScope & {
      candidateId: string;
      command: RejectTaskActionCandidateCommand;
    },
  ): Promise<TaskActionDecisionV1> {
    requireCapabilities(input.capabilities, "task.read");
    const command = normalizeClientCommand(() =>
      normalizeRejectTaskActionCandidateCommand(input.command),
    );
    const taskId = uuidPath(input.taskId, "taskId");
    assertCandidatePath(
      uuidPath(input.candidateId, "candidateId"),
      command.candidateId,
    );
    const reason = command.reason ?? null;
    const idempotencyKey = `reject:${sha256({
      candidateId: command.candidateId,
      actorId: input.actorId,
      reason,
    })}`;
    const result = await mapRepositoryErrors(() =>
      this.repository.appendDecisionWithLock(
        {
          candidateId: command.candidateId,
          tenantId: input.tenantId,
          actorId: input.actorId,
          decision: "rejected",
          idempotencyKey,
        },
        async (candidate) => {
          assertTaskPath(candidate, taskId);
          return normalizeTaskActionDecision({
            decisionId: this.newId(),
            decision: "rejected",
            reason,
            idempotencyKey,
            decidedAt: this.now().toISOString(),
            clientOperationId: null,
            traceId: null,
            executionState: null,
            resultRefs: [],
          });
        },
      ),
    );
    return decisionResponse(result.decision);
  }
}

@Injectable()
export class ConfirmTaskActionCandidateService {
  constructor(
    @Inject(TASK_ACTION_CANDIDATE_REPOSITORY)
    private readonly repository: TaskActionCandidateRepository,
    @Inject(TASK_ASSISTANT_CLAIM_EXECUTION)
    private readonly execution: TaskAssistantClaimExecutionPort,
    @Inject(TASK_ACTION_TRACE_FACTORY)
    private readonly newTraceId: () => string,
    @Optional()
    @Inject(TASK_ACTION_NOW)
    private readonly now: () => Date = () => new Date(),
    @Optional()
    @Inject(TASK_ACTION_ID_FACTORY)
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(
    input: RequestScope & {
      candidateId: string;
      command: ConfirmTaskActionCandidateCommand;
    },
  ): Promise<TaskActionConfirmResultV1> {
    requireCapabilities(input.capabilities, "task.read", "task.execute");
    const command = normalizeClientCommand(() =>
      normalizeConfirmTaskActionCandidateCommand(input.command),
    );
    const taskId = uuidPath(input.taskId, "taskId");
    assertCandidatePath(
      uuidPath(input.candidateId, "candidateId"),
      command.candidateId,
    );
    const scoped = await findScopedCandidate(this.repository, {
      ...input,
      taskId,
      candidateId: command.candidateId,
    });
    if (scoped.candidateHash !== command.candidateHash)
      conflict("CANDIDATE_HASH_MISMATCH");
    const requestTraceId = this.newTraceId();
    let claimResult: TaskAssistantClaimResult | null = null;
    let recoveredOperation = false;
    const persisted = await mapRepositoryErrors(() =>
      this.repository.appendDecisionWithLock(
        {
          candidateId: command.candidateId,
          tenantId: input.tenantId,
          actorId: input.actorId,
          decision: "accepted",
          idempotencyKey: command.idempotencyKey,
        },
        async (candidate) => {
          assertTaskPath(candidate, taskId);
          if (candidate.candidateHash !== command.candidateHash) {
            conflict("CANDIDATE_HASH_MISMATCH");
          }
          claimResult = await this.execution.findClaimReceipt({
            tenantId: input.tenantId,
            actorId: input.actorId,
            workOrderId: candidate.workOrderId,
            idempotencyKey: command.idempotencyKey,
          });
          if (claimResult) {
            recoveredOperation = true;
          } else {
            const snapshot = await resolveCandidateSnapshot(
              this.execution,
              candidate,
            );
            if (!snapshot || !snapshotMatches(candidate, snapshot)) {
              conflict("CANDIDATE_SNAPSHOT_EXPIRED");
            }
            claimResult = await this.execution.claim({
              tenantId: input.tenantId,
              actorId: input.actorId,
              workOrderId: candidate.workOrderId,
              idempotencyKey: command.idempotencyKey,
              traceId: requestTraceId,
            });
          }
          return acceptedDecision({
            candidate,
            claim: claimResult,
            idempotencyKey: command.idempotencyKey,
            now: this.now(),
            decisionId: this.newId(),
          });
        },
      ),
    );

    if (!claimResult) {
      claimResult = await this.execution.findClaimReceipt({
        tenantId: input.tenantId,
        actorId: input.actorId,
        workOrderId: scoped.workOrderId,
        idempotencyKey: command.idempotencyKey,
      });
      recoveredOperation = true;
    }
    if (!claimResult) conflict("CONFIRMATION_RECEIPT_NOT_FOUND");
    const candidate = candidateResponse(scoped, "accepted");
    return {
      contractVersion: "task-action-candidate-confirm-result.v1",
      candidate,
      decision: decisionResponse(persisted.decision),
      claimWorkOrderResult: claimResultResponse(claimResult),
      idempotencyReplay:
        persisted.idempotencyReplay ||
        recoveredOperation ||
        !claimResult.applied,
    };
  }
}

function claimResultResponse(
  result: TaskAssistantClaimResult,
): TaskActionConfirmResultV1["claimWorkOrderResult"] {
  return {
    workOrderId: result.workOrderId,
    workOrderState: result.workOrderState,
    assignmentState: result.assignmentState,
    assigneeId: result.assigneeId,
    taskId: result.taskId,
    taskState: result.taskState,
    applied: result.applied,
    clientOperationId: result.clientOperationId,
    receptionState: result.receptionState,
    businessDecisionState: result.businessDecisionState,
    commitState: result.commitState,
    rejectionReasonCode: result.rejectionReasonCode,
  };
}

function acceptedDecision(input: {
  candidate: TaskActionCandidateRecord;
  claim: TaskAssistantClaimResult;
  idempotencyKey: string;
  now: Date;
  decisionId: string;
}) {
  return normalizeTaskActionDecision({
    decisionId: input.decisionId,
    decision: "accepted",
    reason: null,
    idempotencyKey: input.idempotencyKey,
    decidedAt: input.now.toISOString(),
    clientOperationId: input.claim.clientOperationId,
    traceId: input.claim.traceId,
    executionState: "applied",
    resultRefs: [
      {
        kind: "container",
        id: input.candidate.context.subjectRef.id,
        version: null,
      },
      { kind: "node_task", id: input.claim.taskId, version: null },
      { kind: "work_order", id: input.claim.workOrderId, version: null },
      {
        kind: "client_operation",
        id: input.claim.clientOperationId,
        version: null,
      },
    ],
  });
}

export function taskClaimSnapshotHash(
  snapshot: TaskAssistantClaimSnapshot,
): string {
  return sha256({
    tenantId: snapshot.tenantId,
    subjectRef: snapshot.subjectRef,
    task: snapshot.task,
    workOrder: snapshot.workOrder,
    nextAction: snapshot.nextAction,
  });
}

function snapshotRefs(snapshot: TaskAssistantClaimSnapshot) {
  if (!snapshot.workOrder) return [];
  return [
    { kind: "container" as const, id: snapshot.subjectRef.id, version: null },
    {
      kind: "node_task" as const,
      id: snapshot.task.id,
      version: snapshot.task.version,
    },
    {
      kind: "work_order" as const,
      id: snapshot.workOrder.id,
      version: snapshot.workOrder.version,
    },
  ];
}

function snapshotMatches(
  candidate: TaskActionCandidateRecord,
  snapshot: TaskAssistantClaimSnapshot,
) {
  return (
    snapshot.nextAction?.actionCode === TASK_ACTION_CODE &&
    snapshot.nextAction.workOrderId === candidate.workOrderId &&
    snapshot.workOrder?.id === candidate.workOrderId &&
    taskClaimSnapshotHash(snapshot) === candidate.source.inputSnapshotHash
  );
}

function assertClaimableSnapshot(snapshot: TaskAssistantClaimSnapshot): void {
  if (
    snapshot.nextAction?.actionCode !== TASK_ACTION_CODE ||
    !snapshot.workOrder ||
    snapshot.nextAction.workOrderId !== snapshot.workOrder.id
  ) {
    throw new HttpException(
      "BUSINESS_PRECONDITION_FAILED: NO_CLAIM_ACTION",
      HttpStatus.CONFLICT,
    );
  }
}

async function resolveCandidateSnapshot(
  execution: TaskAssistantClaimExecutionPort,
  candidate: TaskActionCandidateRecord,
) {
  return execution.resolve({
    tenantId: candidate.tenantId,
    taskId: candidate.context.workRef.id,
    subjectRef: candidate.context.subjectRef,
    workOrderId: candidate.workOrderId,
  });
}

async function findScopedCandidate(
  repository: TaskActionCandidateRepository,
  input: {
    tenantId: string;
    actorId: string;
    candidateId: string;
    taskId: string;
  },
) {
  const candidate = await repository.findCandidate({
    candidateId: input.candidateId,
    tenantId: input.tenantId,
    actorId: input.actorId,
  });
  if (!candidate) notFound();
  assertTaskPath(candidate, input.taskId);
  return candidate;
}

function candidateResponse(
  candidate: TaskActionCandidateRecord,
  status: TaskActionCandidateV1["status"],
): TaskActionCandidateV1 {
  return {
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    context: candidate.context,
    workOrderId: candidate.workOrderId,
    actionCode: candidate.actionCode,
    actionVersion: candidate.actionVersion,
    title: candidate.title,
    rationale: candidate.rationale,
    impact: candidate.impact,
    riskLevel: candidate.riskLevel,
    warningCodes: [
      ...candidate.warningCodes,
    ] as TaskActionCandidateV1["warningCodes"],
    status,
    source: {
      ...candidate.source,
      inputRefs: [
        ...candidate.source.inputRefs,
      ] as TaskActionCandidateV1["source"]["inputRefs"],
      generatedAt: candidate.source.generatedAt.toISOString(),
    },
  };
}

function decisionResponse(
  decision: TaskActionDecisionRecord,
): TaskActionDecisionV1 {
  return {
    decisionId: decision.decisionId,
    candidateId: decision.candidateId,
    decidedByActorId: decision.decidedByActorId,
    decision: decision.decision,
    reason: decision.reason,
    idempotencyKey: decision.idempotencyKey,
    decidedAt: decision.decidedAt.toISOString(),
    clientOperationId: decision.clientOperationId,
    traceId: decision.traceId,
    executionState: decision.executionState,
    resultRefs: [...decision.resultRefs] as TaskActionDecisionV1["resultRefs"],
  };
}

function fallbackExplanation() {
  return {
    kind: "fallback" as const,
    rationale: TASK_CLAIM_COPY.rationale,
    impact: TASK_CLAIM_COPY.impact,
    warningCodes: ["confirm_required", "explanation_fallback"],
    modelId: null,
    promptVersion: null,
  };
}

function requireCapabilities(values: readonly string[], ...required: string[]) {
  if (!required.every((capability) => values.includes(capability))) {
    throw new HttpException("AUTHORIZATION_FORBIDDEN", HttpStatus.FORBIDDEN);
  }
}

function normalizeClientCommand<T>(normalize: () => T): T {
  try {
    return normalize();
  } catch (error) {
    if (error instanceof OpsAssistantValidationError) {
      badRequest(error.message);
    }
    throw error;
  }
}

async function mapRepositoryErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CandidateNotFoundError) notFound();
    if (error instanceof CandidateDecisionConflictError) {
      conflict("CANDIDATE_ALREADY_DECIDED");
    }
    throw error;
  }
}

function assertCandidatePath(pathId: string, bodyId: string) {
  if (pathId !== bodyId) badRequest("CANDIDATE_PATH_MISMATCH");
}

function assertTaskPath(candidate: TaskActionCandidateRecord, taskId: string) {
  if (candidate.context.workRef.id !== taskId) notFound();
}

function uuidPath(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) badRequest(`VALIDATION_FORMAT: ${field}`);
  return normalized;
}

function badRequest(code: string): never {
  throw new HttpException(code, HttpStatus.BAD_REQUEST);
}

function notFound(): never {
  throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
}

function conflict(code: string): never {
  throw new HttpException(code, HttpStatus.CONFLICT);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
