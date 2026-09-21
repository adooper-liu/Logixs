import type {
  CargoReadyAssessmentItemSnapshot,
  CargoReadyDecisionCode,
  CargoReadyFinding,
  CargoReadyRuleSnapshot,
  NormalizedCargoReadyAssessment,
  NormalizedCargoReadyDecision,
} from "./cargo-ready-compliance";

export const CARGO_READY_COMPLIANCE_REPOSITORY = Symbol(
  "CargoReadyComplianceRepository",
);

export class CargoReadyComplianceNotFoundError extends Error {}
export class CargoReadyComplianceConflictError extends Error {}

export interface CargoReadyDecisionRecord {
  decisionId: string;
  version: number;
  decisionCode: CargoReadyDecisionCode;
  conditionRefs: string[];
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  decidedAt: string;
}

export interface CargoReadyAssessmentRecord {
  assessmentId: string;
  tenantId: string;
  containerRecordId: string;
  version: number;
  state: "action_required" | "ready_for_decision" | "decided";
  jurisdictionCountryCode: string;
  assessmentDate: string;
  allocationSetId: string | null;
  allocationSetVersion: number | null;
  items: CargoReadyAssessmentItemSnapshot[];
  ruleSnapshots: CargoReadyRuleSnapshot[];
  findings: CargoReadyFinding[];
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  currentDecision: CargoReadyDecisionRecord | null;
  createdAt: string;
}

export interface CargoReadyComplianceRepository {
  replaceAssessment(
    input: NormalizedCargoReadyAssessment,
  ): Promise<{ record: CargoReadyAssessmentRecord; duplicate: boolean }>;
  decide(
    input: NormalizedCargoReadyDecision,
  ): Promise<{ record: CargoReadyAssessmentRecord; duplicate: boolean }>;
  findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CargoReadyAssessmentRecord | null>;
}
