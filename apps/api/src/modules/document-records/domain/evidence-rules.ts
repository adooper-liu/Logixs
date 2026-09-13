export const EVIDENCE_TYPES = [
  "document",
  "api_response",
  "receipt",
  "message",
  "photo",
  "scan",
  "device_record",
  "system_record",
  "attestation",
] as const;

export const SUBJECT_TYPES = [
  "container",
  "flow_instance",
  "node_instance",
  "node_task",
  "work_order",
  "domain_fact",
  "evidence",
  "canonical_event",
  "client_operation",
  "receipt",
  "exception",
  "audit_entry",
] as const;

export const AUTHORITY_LEVELS = [
  "authoritative",
  "corroborating",
  "operational",
  "contextual",
] as const;

export const SOURCE_TYPES = [
  "organization",
  "authority",
  "system",
  "person",
  "device",
] as const;

export const INGESTION_CHANNELS = [
  "api",
  "webhook",
  "file_import",
  "manual_ui",
  "system_internal",
] as const;

export const CAPTURE_SOURCES = [
  "external_evidence",
  "manual_backfill",
  "controlled_import",
  "internal_operation",
  "system_derived",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isContentHash(value: string): boolean {
  return CONTENT_HASH_PATTERN.test(value);
}

export function isQualifiedEvidence(input: {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  verificationState: string;
  validity: string;
  expectedTenantId: string;
  expectedSubjectType: string;
  expectedSubjectId: string;
}): "tenant" | "unqualified" | "ok" {
  if (input.tenantId !== input.expectedTenantId) return "tenant";
  if (
    input.subjectType !== input.expectedSubjectType ||
    input.subjectId !== input.expectedSubjectId ||
    input.verificationState !== "verified" ||
    input.validity !== "effective"
  ) {
    return "unqualified";
  }
  return "ok";
}
