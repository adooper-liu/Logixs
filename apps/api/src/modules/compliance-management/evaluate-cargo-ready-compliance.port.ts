export const EVALUATE_CARGO_READY_COMPLIANCE = Symbol(
  "EvaluateCargoReadyCompliance",
);

export interface CargoReadyComplianceGateResult {
  approved: boolean;
  reasonCode:
    | "CARGO_READY_COMPLIANCE_APPROVED"
    | "CARGO_READY_COMPLIANCE_NOT_ASSESSED"
    | "CARGO_READY_COMPLIANCE_NOT_APPROVED"
    | "CARGO_READY_COMPLIANCE_INPUTS_CHANGED";
  assessmentId: string | null;
  decisionId: string | null;
}

export interface EvaluateCargoReadyCompliancePort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CargoReadyComplianceGateResult>;
}
