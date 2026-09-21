import type { CreateCargoReadyAssessmentCommand } from "./domain/cargo-ready-compliance";
import type { CargoReadyAssessmentRecord } from "./domain/cargo-ready-compliance.repository";

export const ASSESS_CARGO_READY_COMPLIANCE = Symbol(
  "AssessCargoReadyCompliance",
);

export interface AssessCargoReadyCompliancePort {
  execute(
    command: CreateCargoReadyAssessmentCommand,
  ): Promise<{ record: CargoReadyAssessmentRecord; duplicate: boolean }>;
}

export type { CreateCargoReadyAssessmentCommand, CargoReadyAssessmentRecord };
