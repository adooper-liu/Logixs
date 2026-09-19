import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";

export const ASSERT_LIFECYCLE_STATE_EVIDENCE = Symbol(
  "AssertLifecycleStateEvidence",
);

export interface AssertLifecycleStateEvidencePort {
  execute(input: {
    domainFactId: string;
    tenantId: string;
    containerId: string;
    eventCode: CanonicalEventCode;
    occurredAt: Date;
    evidenceRefs: string[];
  }): Promise<{
    domainFactId: string;
    nodeCode: LifecycleNodeCode;
    authorityPolicyRef: string;
  }>;
}
