import { completionRequiresEvidence } from "../data/completionEvidencePolicy";
import { parseEvidenceInput } from "../data/completeReceiptContract";
import { formatHttpError } from "./httpError";

const DEV_TENANT_ID = "dev-tenant";
const DEV_OPERATOR_ID = "dev-operator";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EvidenceRecord {
  evidenceId: string;
  tenantId: string;
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  verificationState: string;
  validity: string;
  recordedAt: string;
  verificationDecisionId: string | null;
}

function identityHeaders(): HeadersInit {
  return {
    "X-Tenant-Id": DEV_TENANT_ID,
    "X-Operator-Id": DEV_OPERATOR_ID,
  };
}

export function isEvidenceUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  return formatHttpError(response.status, await response.text(), fallback);
}

export async function registerEvidence(input: {
  subjectId: string;
  contentRef: string;
}): Promise<EvidenceRecord> {
  const contentRef = input.contentRef.trim().slice(0, 500);
  const response = await fetch("/api/evidence", {
    method: "POST",
    headers: {
      ...identityHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      evidenceType: "document",
      subjectType: "container",
      subjectId: input.subjectId,
      authorityLevel: "operational",
      contentRef,
      contentHash: await sha256Hex(`floor:${input.subjectId}:${contentRef}`),
      sourceType: "person",
      originatorSystem: "logix-web",
      authoritySystem: "ops-team",
      ingestionChannel: "manual_ui",
      captureSource: "internal_operation",
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "登记证据失败"));
  }
  return (await response.json()) as EvidenceRecord;
}

export async function verifyEvidence(
  evidenceId: string,
): Promise<EvidenceRecord> {
  const response = await fetch(`/api/evidence/${evidenceId}/verify`, {
    method: "POST",
    headers: {
      ...identityHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reasonCode: "manual_review",
      reason: "现场作业核对",
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "核验证据失败"));
  }
  return (await response.json()) as EvidenceRecord;
}

export async function registerAndVerifyFloorEvidence(
  containerId: string,
  contentRef: string,
): Promise<string> {
  const record = await registerEvidence({
    subjectId: containerId,
    contentRef,
  });
  const verified = await verifyEvidence(record.evidenceId);
  return verified.evidenceId;
}

export async function resolveCompleteEvidenceRefs(input: {
  nodeCode: string;
  containerId: string | null;
  raw: string;
}): Promise<string[]> {
  const refs = parseEvidenceInput(input.raw);
  if (!completionRequiresEvidence(input.nodeCode)) {
    return refs.filter(isEvidenceUuid);
  }
  if (refs.length === 0 || !input.containerId) {
    throw new Error("EVIDENCE_REQUIRED: 缺少合格证据");
  }
  const resolved: string[] = [];
  for (const ref of refs) {
    resolved.push(
      isEvidenceUuid(ref)
        ? ref
        : await registerAndVerifyFloorEvidence(input.containerId, ref),
    );
  }
  return resolved;
}
