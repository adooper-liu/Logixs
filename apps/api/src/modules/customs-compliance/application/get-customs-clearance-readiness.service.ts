import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMS_CLEARANCE_CASE_REPOSITORY,
  type CustomsClearanceCaseRepository,
} from "../domain/customs-clearance-case.repository";
import type {
  CustomsClearanceReadinessResult,
  GetCustomsClearanceReadinessPort,
} from "../get-customs-clearance-readiness.port";

@Injectable()
export class GetCustomsClearanceReadinessService implements GetCustomsClearanceReadinessPort {
  constructor(
    @Inject(CUSTOMS_CLEARANCE_CASE_REPOSITORY)
    private readonly repository: CustomsClearanceCaseRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
    evidenceRefs: string[];
  }): Promise<CustomsClearanceReadinessResult> {
    const current = await this.repository.findCurrent(input);
    if (!current) return pending("LIFECYCLE_EVENT_PENDING_CUSTOMS_CASE");
    if (current.filingState !== "accepted") {
      return pending(
        "LIFECYCLE_EVENT_PENDING_CUSTOMS_FILING_ACCEPTANCE",
        current.caseId,
      );
    }
    if (
      current.decisionState === "held" ||
      current.activeHoldCodes.length > 0
    ) {
      return pending(
        "LIFECYCLE_EVENT_PENDING_CUSTOMS_HOLD_RELEASE",
        current.caseId,
      );
    }
    if (current.decisionState !== "released") {
      return pending("LIFECYCLE_EVENT_PENDING_CUSTOMS_RELEASE", current.caseId);
    }
    if (!input.evidenceRefs.some((id) => current.evidenceRefs.includes(id))) {
      return pending(
        "LIFECYCLE_EVENT_PENDING_CUSTOMS_EVIDENCE",
        current.caseId,
      );
    }
    return { confirmed: true, reasonCode: null, caseId: current.caseId };
  }
}

function pending(
  reasonCode: Exclude<CustomsClearanceReadinessResult["reasonCode"], null>,
  caseId: string | null = null,
): CustomsClearanceReadinessResult {
  return { confirmed: false, reasonCode, caseId };
}
