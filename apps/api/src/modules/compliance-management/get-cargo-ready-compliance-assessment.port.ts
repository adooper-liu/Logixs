import type { CargoReadyAssessmentRecord } from "./domain/cargo-ready-compliance.repository";

export const GET_CARGO_READY_COMPLIANCE_ASSESSMENT = Symbol(
  "GetCargoReadyComplianceAssessment",
);

export interface GetCargoReadyComplianceAssessmentPort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CargoReadyAssessmentRecord | null>;
}
