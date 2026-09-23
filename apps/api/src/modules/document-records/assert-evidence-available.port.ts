export const ASSERT_EVIDENCE_AVAILABLE = Symbol("AssertEvidenceAvailable");

export interface AssertEvidenceAvailablePort {
  execute(input: { tenantId: string; evidenceIds: string[] }): Promise<void>;
}
