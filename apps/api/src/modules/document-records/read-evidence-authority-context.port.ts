export const READ_EVIDENCE_AUTHORITY_CONTEXT = Symbol.for(
  "logix.ReadEvidenceAuthorityContext",
);

export interface EvidenceAuthorityContext {
  id: string;
  evidenceType: string;
  authorityLevel: string;
  sourceType: string;
  authoritySystem: string;
  verificationState: string;
  validity: string;
}

export interface ReadEvidenceAuthorityContextPort {
  execute(input: {
    tenantId: string;
    subjectType: string;
    subjectId: string;
    evidenceIds: string[];
  }): Promise<EvidenceAuthorityContext[]>;
}
