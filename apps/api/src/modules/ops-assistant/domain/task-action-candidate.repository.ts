import type {
  NormalizedTaskActionDecision,
  TaskActionInputRefKind,
  TaskActionSourceKind,
} from "./task-action-candidate";

export const TASK_ACTION_CANDIDATE_REPOSITORY = Symbol.for(
  "logix.TaskActionCandidateRepository",
);

export interface TaskActionCandidatePersistenceInput {
  candidateId: string;
  tenantId: string;
  actorId: string;
  context: {
    subjectRef: { kind: "container"; id: string };
    workRef: { kind: "node_task"; id: string };
  };
  workOrderId: string;
  actionCode: "work_execution.claim_work_order";
  actionVersion: 1;
  title: string;
  rationale: string;
  impact: string;
  riskLevel: "low";
  warningCodes: readonly string[];
  status: "proposed";
  candidateHash: string;
  source: {
    kind: TaskActionSourceKind;
    capabilityId: "task.claim-assistance";
    capabilityVersion: 1;
    schemaVersion: 1;
    promptVersion: string | null;
    modelId: string | null;
    inputSnapshotHash: string;
    inputRefs: readonly TaskActionTypedRef[];
    generatedAt: Date;
  };
}

export interface TaskActionTypedRef {
  kind: TaskActionInputRefKind | "client_operation";
  id: string;
  version: number | null;
}

export type TaskActionDecisionPersistenceInput = NormalizedTaskActionDecision;

export type TaskActionDecisionRecord = Omit<
  TaskActionDecisionPersistenceInput,
  "decidedAt"
> & {
  candidateId: string;
  decidedByActorId: string;
  decidedAt: Date;
  recordedAt: Date;
};

export interface TaskActionCandidateRecord extends TaskActionCandidatePersistenceInput {
  recordedAt: Date;
  decisions: TaskActionDecisionRecord[];
}

export interface TaskActionCandidateRepository {
  createCandidate(
    input: TaskActionCandidatePersistenceInput,
  ): Promise<TaskActionCandidateRecord>;
  findCandidate(input: {
    candidateId: string;
    tenantId: string;
    actorId: string;
  }): Promise<TaskActionCandidateRecord | null>;
  appendDecision(input: {
    candidateId: string;
    tenantId: string;
    actorId: string;
    decision: TaskActionDecisionPersistenceInput;
  }): Promise<{
    decision: TaskActionDecisionRecord;
    idempotencyReplay: boolean;
  }>;
  appendDecisionWithLock(
    input: {
      candidateId: string;
      tenantId: string;
      actorId: string;
      decision: "accepted" | "rejected";
      idempotencyKey: string;
      decisionHash?: string;
    },
    buildDecision: (
      candidate: TaskActionCandidateRecord,
    ) => Promise<TaskActionDecisionPersistenceInput>,
  ): Promise<{
    decision: TaskActionDecisionRecord;
    idempotencyReplay: boolean;
  }>;
}

export class CandidateNotFoundError extends Error {
  constructor() {
    super("CANDIDATE_NOT_FOUND");
    this.name = "CandidateNotFoundError";
  }
}

export class CandidateDecisionConflictError extends Error {
  constructor() {
    super("CANDIDATE_ALREADY_DECIDED");
    this.name = "CandidateDecisionConflictError";
  }
}
