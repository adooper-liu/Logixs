import type {
  AuthorityLevel,
  CaptureSource,
  EvidenceRecord as ContractEvidenceRecord,
} from "@logix/contracts";
import { completionRequiresEvidence } from "../data/completionEvidencePolicy";
import { parseEvidenceInput } from "../data/completeReceiptContract";
import { requestJson } from "./httpClient";

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

interface EvidenceSourceContext {
  evidenceType?: ContractEvidenceRecord["evidenceType"];
  authorityLevel?: AuthorityLevel;
  sourceType?: ContractEvidenceRecord["source"]["sourceType"];
  authoritySystem?: string;
  captureSource?: CaptureSource;
  subjectType?: string;
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

export async function registerEvidence(
  input: {
    subjectId: string;
    contentRef: string;
  } & EvidenceSourceContext,
): Promise<EvidenceRecord> {
  const contentRef = input.contentRef.trim().slice(0, 500);
  const subjectType = input.subjectType ?? "container";
  return requestJson<EvidenceRecord>("/api/evidence", {
    method: "POST",
    fallback: "登记证据失败",
    body: {
      evidenceType: input.evidenceType ?? "document",
      subjectType,
      subjectId: input.subjectId,
      authorityLevel: input.authorityLevel ?? "operational",
      contentRef,
      contentHash: await sha256Hex(
        `${subjectType}:${input.subjectId}:${contentRef}`,
      ),
      sourceType: input.sourceType ?? "person",
      originatorSystem: "logix-web",
      authoritySystem: input.authoritySystem ?? "ops-team",
      ingestionChannel: "manual_ui",
      captureSource: input.captureSource ?? "internal_operation",
    },
  });
}

export async function verifyEvidence(
  evidenceId: string,
): Promise<EvidenceRecord> {
  return requestJson<EvidenceRecord>(`/api/evidence/${evidenceId}/verify`, {
    method: "POST",
    body: { reasonCode: "manual_review", reason: "现场作业核对" },
    fallback: "核验证据失败",
  });
}

export async function registerAndVerifyFloorEvidence(
  containerId: string,
  contentRef: string,
  context: EvidenceSourceContext = {},
): Promise<string> {
  const record = await registerEvidence({
    subjectId: containerId,
    contentRef,
    ...context,
  });
  const verified = await verifyEvidence(record.evidenceId);
  return verified.evidenceId;
}

export async function registerAndVerifyEvidence(
  subjectType: string,
  subjectId: string,
  contentRef: string,
  context: EvidenceSourceContext = {},
): Promise<string> {
  const record = await registerEvidence({
    subjectType,
    subjectId,
    contentRef,
    ...context,
  });
  if (
    record.verificationState === "verified" &&
    record.validity === "effective"
  ) {
    return record.evidenceId;
  }
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
