export const GET_CUSTOMS_CLEARANCE_READINESS = Symbol.for(
  "logix.GetCustomsClearanceReadiness",
);

export type CustomsClearancePendingReason =
  | "LIFECYCLE_EVENT_PENDING_CUSTOMS_CASE"
  | "LIFECYCLE_EVENT_PENDING_CUSTOMS_FILING_ACCEPTANCE"
  | "LIFECYCLE_EVENT_PENDING_CUSTOMS_RELEASE"
  | "LIFECYCLE_EVENT_PENDING_CUSTOMS_HOLD_RELEASE"
  | "LIFECYCLE_EVENT_PENDING_CUSTOMS_EVIDENCE";

export interface CustomsClearanceReadinessResult {
  confirmed: boolean;
  reasonCode: CustomsClearancePendingReason | null;
  caseId: string | null;
}

export interface GetCustomsClearanceReadinessPort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
    evidenceRefs: string[];
  }): Promise<CustomsClearanceReadinessResult>;
}
