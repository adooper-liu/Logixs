import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AssertLifecycleStateEvidencePort } from "../assert-lifecycle-state-evidence.port";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
import { decideLifecycleStateEvidence } from "../domain/lifecycle-state-evidence";

@Injectable()
export class AssertLifecycleStateEvidenceService implements AssertLifecycleStateEvidencePort {
  constructor(
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly dateFacts: LifecycleDateFactRepository,
  ) {}

  async execute(
    input: Parameters<AssertLifecycleStateEvidencePort["execute"]>[0],
  ): ReturnType<AssertLifecycleStateEvidencePort["execute"]> {
    const fact = await this.dateFacts.findById(input.domainFactId);
    if (!fact) {
      throw new HttpException(
        "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE: 规范事实不存在",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const decision = decideLifecycleStateEvidence({ fact, ...input });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.reasonCode}: 规范事实不具备状态证据资格`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return {
      domainFactId: fact.id,
      nodeCode: fact.nodeCode,
      authorityPolicyRef: decision.authorityPolicyRef,
      location: fact.location,
    };
  }
}
