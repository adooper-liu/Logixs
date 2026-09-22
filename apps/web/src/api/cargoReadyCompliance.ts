import { DEV_TENANT_ID } from "./developmentIdentity";
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

const IDENTITY_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-compliance-reviewer",
  "X-Roles": "review_supervisor",
};

export async function getCargoReadyCompliance(
  containerId: string,
  signal?: AbortSignal,
): Promise<CargoReadyComplianceAssessment | null> {
  const response = await fetch(endpoint(containerId), {
    headers: IDENTITY_HEADERS,
    signal,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载备货合规评审失败",
      ),
    );
  }
  return (await response.json()) as CargoReadyComplianceAssessment | null;
}

export async function assessCargoReadyCompliance(
  containerId: string,
  input: AssessCargoReadyComplianceInput,
): Promise<void> {
  const response = await fetch(`${endpoint(containerId)}/assessments`, {
    method: "POST",
    headers: { ...IDENTITY_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
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
  const response = await fetch(`${endpoint(containerId)}/decisions`, {
    method: "POST",
    headers: { ...IDENTITY_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "提交合规决定失败",
      ),
    );
  }
  return (await response.json()) as CargoReadyDecisionResponse;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/compliance/cargo-ready`;
}
