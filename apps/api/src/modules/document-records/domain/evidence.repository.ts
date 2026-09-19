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
  decision: "verified" | "rejected" | "revoked";
  nextState: "verified" | "rejected" | "revoked";
  nextValidity: "effective" | "revoked";
  actorOrServiceId: string;
  reasonCode: string;
  reason?: string;
  previousDecisionId?: string | null;
}

export interface AppendDecisionResult {
  record: EvidenceRecord;
  decisionId: string;
  appended: boolean;
}

export interface EvidenceRepository {
  findById(id: string): Promise<EvidenceRecord | null>;
  findByIds(ids: string[]): Promise<EvidenceRecord[]>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<EvidenceRecord | null>;
  create(input: CreateEvidenceInput): Promise<EvidenceRecord>;
  findLatestVerifiedDecisionId(evidenceId: string): Promise<string | null>;
  appendDecision(input: AppendDecisionInput): Promise<AppendDecisionResult>;
}
