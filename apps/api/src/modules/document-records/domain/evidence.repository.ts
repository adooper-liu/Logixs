export const EVIDENCE_REPOSITORY = Symbol("EvidenceRepository");

export interface EvidenceSourceSnapshot {
  sourceId: string;
  sourceType: string;
  originatorSystem: string;
  authoritySystem: string;
  provider?: string;
  providerVersion?: string;
  interfaceCode?: string;
  sourceReference?: string;
  sourceEventId?: string;
  mappingVersion?: string;
  ingestionChannel: string;
  captureSource: string;
  sourceSummary?: string;
}

export interface EvidenceRecord {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  authorityLevel: string;
  contentRef: string;
  contentHash: string;
  source: EvidenceSourceSnapshot;
  verificationState: string;
  confidenceState: string;
  validity: string;
  receivedAt: Date;
  recordedAt: Date;
}

export interface CreateEvidenceInput {
  tenantId: string;
  idempotencyKey: string;
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  authorityLevel: string;
  contentRef: string;
  contentHash: string;
  source: EvidenceSourceSnapshot;
  receivedAt: Date;
  recordedAt: Date;
}

export interface AppendDecisionInput {
  evidenceId: string;
  tenantId: string;
  decision: "verified" | "rejected" | "revoked";
  actorOrServiceId: string;
  reasonCode: string;
  reason?: string;
}

export interface AppendDecisionResult {
  record: EvidenceRecord;
  decisionId: string | null;
  appended: boolean;
}

export class EvidenceDecisionNotFoundError extends Error {
  constructor() {
    super("RESOURCE_NOT_FOUND");
  }
}

export class EvidenceDecisionScopeDeniedError extends Error {
  constructor() {
    super("AUTHORIZATION_SCOPE_DENIED");
  }
}

export class EvidenceDecisionTransitionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

export interface TaskCollaborationEvidenceQuery {
  tenantId: string;
  subjectType: "container";
  subjectId: string;
  validity: "effective";
  evidenceRecordIds: string[];
}

export interface EvidenceRepository {
  findById(id: string): Promise<EvidenceRecord | null>;
  findByIds(ids: string[]): Promise<EvidenceRecord[]>;
  findTaskCollaborationEvidence(
    input: TaskCollaborationEvidenceQuery,
  ): Promise<EvidenceRecord[]>;
  listBySubjects(input: {
    tenantId: string;
    subjectType: string;
    subjectIds: string[];
  }): Promise<EvidenceRecord[]>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<EvidenceRecord | null>;
  create(input: CreateEvidenceInput): Promise<EvidenceRecord>;
  findLatestVerifiedDecisionId(evidenceId: string): Promise<string | null>;
  appendDecision(input: AppendDecisionInput): Promise<AppendDecisionResult>;
}
