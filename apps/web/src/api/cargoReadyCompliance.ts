import { requestApi, requestJson } from "./httpClient";
import { formatHttpError } from "./httpError";

export interface CargoReadyComplianceItem {
  replenishmentOrderLineId: string;
  productSkuId: string;
  productNumber: string;
  complianceProfileId: string | null;
  complianceProfileVersion: number | null;
}

export interface CargoReadyComplianceRule {
  ruleVersionId: string;
  ruleCode: string;
  version: number;
  productSkuId: string;
  requirementLayer: string;
  requiredCertificateTypes: readonly string[];
  blockingNodeCodes: readonly string[];
  severity: string;
  officialSourceUrl: string;
  legalCitation: string;
}

export interface CargoReadyComplianceFinding {
  code: string;
  productSkuId: string | null;
  ruleVersionId: string | null;
  detail: string;
}

export interface CargoReadyComplianceDecision {
  decisionId: string;
  version: number;
  decisionCode: string;
  conditionRefs: readonly string[];
  evidenceRefs: readonly string[];
  actorId: string;
  reasonCode: string;
  decidedAt: string;
}

export interface CargoReadyComplianceAssessment {
  assessmentId: string;
  containerRecordId: string;
  version: number;
  state: string;
  jurisdictionCountryCode: string;
  assessmentDate: string;
  allocationSetId: string | null;
  allocationSetVersion: number | null;
  items: readonly CargoReadyComplianceItem[];
  findings: readonly CargoReadyComplianceFinding[];
  applicableRules: readonly CargoReadyComplianceRule[];
  evidenceRefs: readonly string[];
  actorId: string;
  reasonCode: string;
  currentDecision: CargoReadyComplianceDecision | null;
  createdAt: string;
}

export interface AssessCargoReadyComplianceInput {
  jurisdictionCountryCode: string;
  assessmentDate: string;
  expectedAssessmentVersion: number;
  evidenceRefs: string[];
  reasonCode: string;
  idempotencyKey: string;
}

export interface DecideCargoReadyComplianceInput {
  assessmentId: string;
  expectedDecisionVersion: number;
  decisionCode:
    "approved" | "approved_with_conditions" | "blocked" | "evidence_required";
  conditionRefs?: string[];
  evidenceRefs: string[];
  reasonCode: string;
  idempotencyKey: string;
}

export interface CargoReadyDecisionResponse {
  assessmentId: string;
  version: number;
  state: string;
  duplicate: boolean;
  replay: {
    status:
      | "not_requested"
      | "no_pending_facts"
      | "completed"
      | "deferred"
      | "retry_required";
    reasonCode: string;
    claimed: number;
    applied: number;
    pending: number;
    rejected: number;
  };
}

export async function getCargoReadyCompliance(
  containerId: string,
  signal?: AbortSignal,
): Promise<CargoReadyComplianceAssessment | null> {
  return requestJson<CargoReadyComplianceAssessment | null>(
    endpoint(containerId),
    { fallback: "加载备货合规评审失败", signal },
  );
}

export async function assessCargoReadyCompliance(
  containerId: string,
  input: AssessCargoReadyComplianceInput,
): Promise<void> {
  const response = await requestApi(`${endpoint(containerId)}/assessments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    fallback: "创建备货合规评审失败",
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "创建备货合规评审失败",
      ),
    );
  }
}

export async function decideCargoReadyCompliance(
  containerId: string,
  input: DecideCargoReadyComplianceInput,
): Promise<CargoReadyDecisionResponse> {
  return requestJson<CargoReadyDecisionResponse>(
    `${endpoint(containerId)}/decisions`,
    { method: "POST", body: input, fallback: "提交合规决定失败" },
  );
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/compliance/cargo-ready`;
}
