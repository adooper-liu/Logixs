import { Inject, Injectable } from "@nestjs/common";
import {
  READ_EVIDENCE_AUTHORITY_CONTEXT,
  type ReadEvidenceAuthorityContextPort,
} from "../../document-records";
import {
  decideLifecycleDateAuthority,
  type LifecycleDateAuthorityDecision,
  type LifecycleDateAuthorityInput,
} from "../domain/source-authority-decision";
import {
  SOURCE_AUTHORITY_POLICY_REPOSITORY,
  type SourceAuthorityPolicyRepository,
} from "../domain/source-authority-policy.repository";

export interface EvaluateLifecycleDateAuthorityInput extends LifecycleDateAuthorityInput {
  containerId: string;
  evidenceRefs: string[];
}

@Injectable()
export class EvaluateLifecycleDateAuthorityService {
  constructor(
    @Inject(SOURCE_AUTHORITY_POLICY_REPOSITORY)
    private readonly policies: SourceAuthorityPolicyRepository,
    @Inject(READ_EVIDENCE_AUTHORITY_CONTEXT)
    private readonly evidence: ReadEvidenceAuthorityContextPort,
  ) {}

  async execute(
    input: EvaluateLifecycleDateAuthorityInput,
  ): Promise<LifecycleDateAuthorityDecision> {
    const [policies, evidence] = await Promise.all([
      this.policies.listEffectiveCandidates(input),
      this.evidence.execute({
        tenantId: input.tenantId,
        subjectType: "container",
        subjectId: input.containerId,
        evidenceIds: input.evidenceRefs,
      }),
    ]);
    return decideLifecycleDateAuthority(input, policies, evidence);
  }
}
