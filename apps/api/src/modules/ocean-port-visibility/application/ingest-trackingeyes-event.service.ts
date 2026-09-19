import { createHash, randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  CanonicalEventCode,
  LifecycleDateFactResult,
  LifecycleNodeCode,
} from "@logix/contracts";
import canonicalEvents from "@logix/contracts/canonical-events.json";
import {
  REGISTER_EVIDENCE,
  type RegisterEvidencePort,
} from "../../document-records";
import {
  RECORD_LIFECYCLE_DATE_FACT,
  type RecordLifecycleDateFactPort,
} from "../../lifecycle-control";
import {
  RESOLVE_CONTAINER_BY_NUMBER,
  type ResolveContainerByNumberPort,
} from "../../shipment-registry";
import {
  normalizeTrackingEyesContainerStatus,
  TRACKINGEYES_OCEAN_MAPPING_VERSION,
  TRACKINGEYES_PROVIDER,
  type TrackingEyesContainerStatusInput,
  type TrackingEyesNormalizationResult,
} from "../domain/trackingeyes-event-candidate";
import {
  PROVIDER_EVENT_INGESTION_REPOSITORY,
  type ProviderEventIngestionRecord,
  type ProviderEventIngestionRepository,
} from "../domain/provider-event-ingestion.repository";
import { decideTrackingEyesSourceAuthority } from "../domain/trackingeyes-source-authority";
import type { TrackingEyesObjectResolution } from "../domain/trackingeyes-source-authority";

export const TRACKINGEYES_CONTAINER_STATUS_CONSUMER =
  "ocean-port-visibility.trackingeyes.container-status.v1" as const;
export const TRACKINGEYES_CONTAINER_STATUS_INTERFACE =
  "trackingeyes.container.status" as const;
export const TRACKINGEYES_PAYLOAD_HASH_VERSION =
  "trackingeyes-container-status-canonical-v1" as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNRESOLVED_AUTHORITY_SYSTEM = "unresolved";

export type TrackingEyesIngressPayload = Omit<
  TrackingEyesContainerStatusInput,
  "payloadHash"
>;

export interface IngestTrackingEyesEventInput {
  tenantId: string;
  serviceId: string;
  messageId: string;
  traceId: string;
  payload: TrackingEyesIngressPayload;
}

export interface IngestTrackingEyesEventResult {
  ingestionId: string;
  inboxRecordId: string;
  messageId: string;
  receptionState: "processed" | "duplicate";
  applied: boolean;
  normalizationKind: ProviderEventIngestionRecord["normalizationKind"];
  canonicalEventCode: string | null;
  authorityDecision: ProviderEventIngestionRecord["authorityDecision"];
  confidenceState: ProviderEventIngestionRecord["confidenceState"];
  reasonCodes: string[];
  lifecycleApplication: "not_applied";
  objectResolutionState: ProviderEventIngestionRecord["objectResolutionState"];
  containerRecordId: string | null;
  evidenceId: string | null;
  dateFactId: string | null;
  dateFactApplicationState: LifecycleDateFactResult["applicationState"] | null;
}

@Injectable()
export class IngestTrackingEyesEventService {
  constructor(
    @Inject(PROVIDER_EVENT_INGESTION_REPOSITORY)
    private readonly repository: ProviderEventIngestionRepository,
    @Inject(RESOLVE_CONTAINER_BY_NUMBER)
    private readonly resolveContainer: ResolveContainerByNumberPort,
    @Inject(REGISTER_EVIDENCE)
    private readonly registerEvidence: RegisterEvidencePort,
    @Inject(RECORD_LIFECYCLE_DATE_FACT)
    private readonly recordDateFact: RecordLifecycleDateFactPort,
  ) {}

  async execute(
    input: IngestTrackingEyesEventInput,
  ): Promise<IngestTrackingEyesEventResult> {
    validateEnvelope(input);
    const tenantId = input.tenantId.trim();
    const messageId = input.messageId.trim();
    const rawPayload = buildRawPayloadSnapshot(input.payload);
    const payloadHash = hashTrackingEyesPayload(rawPayload);

    const existing = await this.repository.findByInboxMessage({
      consumerName: TRACKINGEYES_CONTAINER_STATUS_CONSUMER,
      messageId,
    });
    if (existing) {
      assertReplayCompatible(existing, tenantId, payloadHash);
      return this.recordCandidateFact(existing, "duplicate", false);
    }

    const normalization = normalizeTrackingEyesContainerStatus({
      ...input.payload,
      payloadHash,
    });
    const objectResolution = await this.resolveBusinessObject(
      tenantId,
      input.payload.containerNumber,
      normalization.kind,
    );
    const authority = decideTrackingEyesSourceAuthority(
      normalization,
      objectResolution,
    );
    const now = new Date();
    const record = buildRecord({
      input,
      tenantId,
      messageId,
      rawPayload,
      payloadHash,
      normalization,
      objectResolution,
      authority,
      now,
    });

    try {
      await this.repository.insertProcessed(record);
    } catch {
      const raced = await this.repository.findByInboxMessage({
        consumerName: TRACKINGEYES_CONTAINER_STATUS_CONSUMER,
        messageId,
      });
      if (raced) {
        assertReplayCompatible(raced, tenantId, payloadHash);
        return this.recordCandidateFact(raced, "duplicate", false);
      }
      throw new HttpException(
        "INTERNAL_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.recordCandidateFact(record, "processed", true);
  }

  private async recordCandidateFact(
    record: ProviderEventIngestionRecord,
    receptionState: IngestTrackingEyesEventResult["receptionState"],
    applied: boolean,
  ): Promise<IngestTrackingEyesEventResult> {
    if (!isRecordableCandidate(record)) {
      return toResult(record, receptionState, applied, null);
    }

    const evidence = await this.registerEvidence.execute({
      tenantId: record.tenantId,
      idempotencyKey: `trackingeyes:evidence:${record.id}`,
      evidenceType: "api_response",
      subjectType: "container",
      subjectId: record.containerRecordId,
      authorityLevel: evidenceAuthorityLevel(record.sourceSignal),
      contentRef: `ocean-provider-event/${record.id}`,
      contentHash: record.payloadHash,
      sourceType: "system",
      originatorSystem: record.provider,
      authoritySystem: UNRESOLVED_AUTHORITY_SYSTEM,
      provider: record.provider,
      interfaceCode: record.interfaceCode,
      sourceReference: `ocean-provider-event/${record.id}`,
      sourceEventId: record.providerEventIdRaw ?? record.id,
      mappingVersion: record.mappingVersion,
      ingestionChannel: "webhook",
      captureSource: "external_evidence",
    });
    const event = canonicalEvents.find(
      (candidate) => candidate.eventCode === record.canonicalEventCode,
    ) as
      | {
          eventCode: CanonicalEventCode;
          defaultNodeCode: LifecycleNodeCode | null;
        }
      | undefined;
    if (!event?.defaultNodeCode) {
      throw new Error("CANONICAL_EVENT_NODE_INVARIANT_VIOLATION");
    }
    const dateFact = await this.recordDateFact.execute({
      tenantId: record.tenantId,
      containerId: record.containerRecordId,
      nodeCode: event.defaultNodeCode,
      eventCode: event.eventCode,
      timeKind: record.timeKind,
      occurredAt: record.occurredAt.toISOString(),
      rawValue: record.eventTimeRaw,
      sourceUtcOffset: sourceUtcOffset(record.eventTimeRaw),
      ingestionChannel: "webhook",
      captureSource: "external_evidence",
      sourceSystem: record.provider,
      authoritySystem: UNRESOLVED_AUTHORITY_SYSTEM,
      provider: record.provider,
      interfaceCode: record.interfaceCode,
      sourceEventId: record.providerEventIdRaw ?? record.id,
      mappingVersion: record.mappingVersion,
      verificationState: "pending",
      confidenceState: record.confidenceState,
      validity: "effective",
      evidenceRefs: [evidence.id],
      idempotencyKey: `trackingeyes:date-fact:${record.id}`,
      traceId: record.traceId,
    });
    return toResult(record, receptionState, applied, {
      evidenceId: evidence.id,
      dateFactId: dateFact.factId,
      dateFactApplicationState: dateFact.applicationState,
    });
  }

  private async resolveBusinessObject(
    tenantId: string,
    containerNumber: string,
    normalizationKind: TrackingEyesNormalizationResult["kind"],
  ): Promise<TrackingEyesObjectResolution> {
    if (normalizationKind === "rejected") {
      return { state: "not_attempted", containerId: null };
    }
    return this.resolveContainer.execute({ tenantId, containerNumber });
  }
}

function validateEnvelope(input: IngestTrackingEyesEventInput): void {
  if (!input.tenantId.trim()) {
    throw new HttpException(
      "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
      HttpStatus.FORBIDDEN,
    );
  }
  if (!input.serviceId.trim() || input.serviceId.length > 128) {
    throw new HttpException(
      "VALIDATION_FORMAT: serviceId 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!UUID_PATTERN.test(input.messageId.trim())) {
    throw new HttpException(
      "VALIDATION_FORMAT: messageId 必须是 UUID",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.traceId.trim() || input.traceId.length > 128) {
    throw new HttpException(
      "VALIDATION_FORMAT: traceId 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
}

function buildRawPayloadSnapshot(
  payload: TrackingEyesIngressPayload,
): Record<string, unknown> {
  return {
    providerEventId: payload.providerEventId ?? null,
    localKey: payload.localKey ?? null,
    containerNumber: payload.containerNumber,
    rawCode: payload.rawCode,
    eventTime: payload.eventTime,
    isEstimate: payload.isEstimate,
    sourceCode: payload.sourceCode,
    dataState: payload.dataState ?? null,
    placeCode: payload.placeCode ?? null,
    placeName: payload.placeName ?? null,
    vesselName: payload.vesselName ?? null,
    voyage: payload.voyage ?? null,
  };
}

export function hashTrackingEyesPayload(
  payload: Record<string, unknown>,
): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function buildRecord(input: {
  input: IngestTrackingEyesEventInput;
  tenantId: string;
  messageId: string;
  rawPayload: Record<string, unknown>;
  payloadHash: string;
  normalization: TrackingEyesNormalizationResult;
  objectResolution: TrackingEyesObjectResolution;
  authority: ReturnType<typeof decideTrackingEyesSourceAuthority>;
  now: Date;
}): ProviderEventIngestionRecord {
  const normalized = normalizedFields(input.normalization);
  return {
    id: randomUUID(),
    inboxRecordId: randomUUID(),
    tenantId: input.tenantId,
    consumerName: TRACKINGEYES_CONTAINER_STATUS_CONSUMER,
    messageId: input.messageId,
    provider: TRACKINGEYES_PROVIDER,
    interfaceCode: TRACKINGEYES_CONTAINER_STATUS_INTERFACE,
    providerEventIdRaw: input.input.payload.providerEventId ?? null,
    idempotencyKey: normalized.idempotencyKey,
    rawPayload: input.rawPayload,
    payloadHash: input.payloadHash,
    payloadHashVersion: TRACKINGEYES_PAYLOAD_HASH_VERSION,
    containerNumberRaw: input.input.payload.containerNumber,
    containerRecordId: input.objectResolution.containerId,
    objectResolutionState: input.objectResolution.state,
    objectResolutionReasonCode: objectResolutionReasonCode(
      input.objectResolution.state,
    ),
    rawCode: input.input.payload.rawCode,
    eventTimeRaw: input.input.payload.eventTime,
    mappingVersion: TRACKINGEYES_OCEAN_MAPPING_VERSION,
    normalizationKind: input.normalization.kind,
    canonicalEventCode: normalized.canonicalEventCode,
    occurredAt: normalized.occurredAt,
    timeKind: normalized.timeKind,
    sourceCodeRaw: input.input.payload.sourceCode,
    sourceSignal: normalized.sourceSignal,
    authorityDecision: input.authority.decision,
    authorityPolicyRef: input.authority.policyRef,
    confidenceState: input.authority.confidenceState,
    reasonCodes: input.authority.reasonCodes,
    lifecycleApplication: input.authority.lifecycleApplication,
    decidedBy: input.input.serviceId.trim(),
    traceId: input.input.traceId.trim(),
    receivedAt: input.now,
    decidedAt: input.now,
  };
}

function normalizedFields(normalization: TrackingEyesNormalizationResult): {
  idempotencyKey: string | null;
  canonicalEventCode: string | null;
  occurredAt: Date | null;
  timeKind: "estimated" | "actual" | null;
  sourceSignal: string | null;
} {
  if (normalization.kind === "candidate") {
    return {
      idempotencyKey: normalization.candidate.idempotencyKey,
      canonicalEventCode: normalization.candidate.eventCode,
      occurredAt: normalization.candidate.occurredAt,
      timeKind: normalization.candidate.timeKind,
      sourceSignal: normalization.candidate.sourceSignal,
    };
  }
  if (normalization.kind === "review_required") {
    return {
      idempotencyKey: normalization.idempotencyKey,
      canonicalEventCode: null,
      occurredAt: null,
      timeKind: null,
      sourceSignal: null,
    };
  }
  return {
    idempotencyKey: null,
    canonicalEventCode: null,
    occurredAt: null,
    timeKind: null,
    sourceSignal: null,
  };
}

function assertReplayCompatible(
  existing: ProviderEventIngestionRecord,
  tenantId: string,
  payloadHash: string,
): void {
  if (existing.tenantId !== tenantId) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: Inbox messageId 租户范围冲突",
      HttpStatus.CONFLICT,
    );
  }
  if (existing.payloadHash !== payloadHash) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: 同一 Inbox messageId 对应不同载荷",
      HttpStatus.CONFLICT,
    );
  }
}

function toResult(
  record: ProviderEventIngestionRecord,
  receptionState: IngestTrackingEyesEventResult["receptionState"],
  applied: boolean,
  downstream: {
    evidenceId: string;
    dateFactId: string;
    dateFactApplicationState: LifecycleDateFactResult["applicationState"];
  } | null,
): IngestTrackingEyesEventResult {
  return {
    ingestionId: record.id,
    inboxRecordId: record.inboxRecordId,
    messageId: record.messageId,
    receptionState,
    applied,
    normalizationKind: record.normalizationKind,
    canonicalEventCode: record.canonicalEventCode,
    authorityDecision: record.authorityDecision,
    confidenceState: record.confidenceState,
    reasonCodes: record.reasonCodes,
    lifecycleApplication: record.lifecycleApplication,
    objectResolutionState: record.objectResolutionState,
    containerRecordId: record.containerRecordId,
    evidenceId: downstream?.evidenceId ?? null,
    dateFactId: downstream?.dateFactId ?? null,
    dateFactApplicationState: downstream?.dateFactApplicationState ?? null,
  };
}

function isRecordableCandidate(
  record: ProviderEventIngestionRecord,
): record is ProviderEventIngestionRecord & {
  containerRecordId: string;
  canonicalEventCode: NonNullable<
    ProviderEventIngestionRecord["canonicalEventCode"]
  >;
  occurredAt: Date;
  timeKind: NonNullable<ProviderEventIngestionRecord["timeKind"]>;
} {
  return (
    record.normalizationKind === "candidate" &&
    record.objectResolutionState === "resolved" &&
    record.containerRecordId !== null &&
    record.canonicalEventCode !== null &&
    record.occurredAt !== null &&
    record.timeKind !== null
  );
}

function evidenceAuthorityLevel(
  sourceSignal: string | null,
): "corroborating" | "contextual" {
  return sourceSignal === "carrier" || sourceSignal === "terminal"
    ? "corroborating"
    : "contextual";
}

function sourceUtcOffset(rawValue: string): string {
  if (/Z$/i.test(rawValue)) return "+00:00";
  const match = rawValue.match(/([+-]\d{2}:\d{2})$/);
  if (!match) throw new Error("EXTERNAL_EVENT_TIME_ZONE_REQUIRED");
  return match[1];
}

function objectResolutionReasonCode(
  state: ProviderEventIngestionRecord["objectResolutionState"],
): string | null {
  if (state === "not_found") return "business_object_not_found";
  if (state === "ambiguous") return "business_object_ambiguous";
  return null;
}
