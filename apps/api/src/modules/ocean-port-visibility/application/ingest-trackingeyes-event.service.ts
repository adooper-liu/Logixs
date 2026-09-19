import { createHash, randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
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
}

@Injectable()
export class IngestTrackingEyesEventService {
  constructor(
    @Inject(PROVIDER_EVENT_INGESTION_REPOSITORY)
    private readonly repository: ProviderEventIngestionRepository,
    @Inject(RESOLVE_CONTAINER_BY_NUMBER)
    private readonly resolveContainer: ResolveContainerByNumberPort,
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
    if (existing) return reuseOrConflict(existing, tenantId, payloadHash);

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
      if (raced) return reuseOrConflict(raced, tenantId, payloadHash);
      throw new HttpException(
        "INTERNAL_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return toResult(record, "processed", true);
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

function reuseOrConflict(
  existing: ProviderEventIngestionRecord,
  tenantId: string,
  payloadHash: string,
): IngestTrackingEyesEventResult {
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
  return toResult(existing, "duplicate", false);
}

function toResult(
  record: ProviderEventIngestionRecord,
  receptionState: IngestTrackingEyesEventResult["receptionState"],
  applied: boolean,
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
  };
}

function objectResolutionReasonCode(
  state: ProviderEventIngestionRecord["objectResolutionState"],
): string | null {
  if (state === "not_found") return "business_object_not_found";
  if (state === "ambiguous") return "business_object_ambiguous";
  return null;
}
