import type { TrackingEyesAuthorityDecision } from "./trackingeyes-source-authority";

export const PROVIDER_EVENT_INGESTION_REPOSITORY = Symbol(
  "ProviderEventIngestionRepository",
);

export interface ProviderEventIngestionRecord {
  id: string;
  inboxRecordId: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  provider: string;
  interfaceCode: string;
  providerEventIdRaw: string | null;
  idempotencyKey: string | null;
  rawPayload: Record<string, unknown>;
  payloadHash: string;
  payloadHashVersion: string;
  containerNumberRaw: string;
  containerRecordId: string | null;
  objectResolutionState:
    "resolved" | "not_found" | "ambiguous" | "not_attempted";
  objectResolutionReasonCode: string | null;
  rawCode: string;
  eventTimeRaw: string;
  mappingVersion: string;
  normalizationKind: "candidate" | "review_required" | "rejected";
  canonicalEventCode: string | null;
  occurredAt: Date | null;
  timeKind: "estimated" | "actual" | null;
  sourceCodeRaw: string;
  sourceSignal: string | null;
  authorityDecision: TrackingEyesAuthorityDecision["decision"];
  authorityPolicyRef: string | null;
  confidenceState: TrackingEyesAuthorityDecision["confidenceState"];
  reasonCodes: string[];
  lifecycleApplication: "not_applied";
  decidedBy: string;
  traceId: string;
  receivedAt: Date;
  decidedAt: Date;
}

export interface ProviderEventIngestionRepository {
  findByInboxMessage(input: {
    consumerName: string;
    messageId: string;
  }): Promise<ProviderEventIngestionRecord | null>;

  insertProcessed(record: ProviderEventIngestionRecord): Promise<void>;
}
