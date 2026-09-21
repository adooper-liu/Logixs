import { Inject, Injectable } from "@nestjs/common";
import type { GetCargoReadyComplianceAssessmentPort } from "../get-cargo-ready-compliance-assessment.port";
import {
  CARGO_READY_COMPLIANCE_REPOSITORY,
  type CargoReadyAssessmentRecord,
  type CargoReadyComplianceRepository,
} from "../domain/cargo-ready-compliance.repository";

@Injectable()
export class GetCargoReadyComplianceAssessmentService implements GetCargoReadyComplianceAssessmentPort {
  constructor(
    @Inject(CARGO_READY_COMPLIANCE_REPOSITORY)
    private readonly repository: CargoReadyComplianceRepository,
  ) {}

  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CargoReadyAssessmentRecord | null> {
    return this.repository.findCurrent(input);
  }
}
