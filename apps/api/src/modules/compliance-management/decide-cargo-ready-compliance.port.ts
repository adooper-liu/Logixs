import type { DecideCargoReadyComplianceCommand } from "./domain/cargo-ready-compliance";
import type { CargoReadyAssessmentRecord } from "./domain/cargo-ready-compliance.repository";

export const DECIDE_CARGO_READY_COMPLIANCE = Symbol(
  "DecideCargoReadyCompliance",
);

export interface DecideCargoReadyCompliancePort {
  execute(
    command: DecideCargoReadyComplianceCommand,
  ): Promise<{ record: CargoReadyAssessmentRecord; duplicate: boolean }>;
}

export type { DecideCargoReadyComplianceCommand };
