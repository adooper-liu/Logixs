import type { CanonicalEventCode } from "@logix/contracts";

export const TRACKINGEYES_PROVIDER = "trackingeyes" as const;
export const TRACKINGEYES_OCEAN_CONTEXT = "ocean_container_status" as const;
export const TRACKINGEYES_OCEAN_MAPPING_VERSION =
  "trackingeyes-ocean-reference-2026-09-18" as const;

const TIME_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const PROVIDER_EVENT_ID = /^[A-Za-z0-9._:-]{1,200}$/;

const TRACKINGEYES_OCEAN_EVENT_MAP = {
  DLPT: "departed",
  TSBA: "transit_arrived",
  TSDP: "transit_departed",
  BDAR: "arrived",
  DSCH: "discharged",
} as const satisfies Readonly<Record<string, CanonicalEventCode>>;

export type TrackingEyesSourceSignal =
  "carrier" | "terminal" | "provider_computed" | "unknown";

export type TrackingEyesCandidateReviewReason =
  | "mapping_pending_provider_validation"
  | "source_authority_policy_required"
  | "estimated_event"
  | "provider_computed"
  | "unknown_source_code";

export interface TrackingEyesContainerStatusInput {
  providerEventId?: string;
  localKey?: string;
  containerNumber: string;
  rawCode: string;
  eventTime: string;
  isEstimate: boolean;
  sourceCode: string;
  dataState?: "add" | "update" | "delete";
  payloadHash?: string;
  placeCode?: string;
  placeName?: string;
  vesselName?: string;
  voyage?: string;
}

export interface TrackingEyesEventCandidate {
  provider: typeof TRACKINGEYES_PROVIDER;
  context: typeof TRACKINGEYES_OCEAN_CONTEXT;
  mappingVersion: typeof TRACKINGEYES_OCEAN_MAPPING_VERSION;
  mappingVerification: "pending_provider_validation";
  providerEventId: string | null;
  idempotencyKey: string;
  containerNumber: string;
  rawCode: string;
  eventCode: CanonicalEventCode;
  eventTimeRaw: string;
  occurredAt: Date;
  timeKind: "estimated" | "actual";
  sourceCodeRaw: string;
  sourceSignal: TrackingEyesSourceSignal;
  placeCode: string | null;
  placeName: string | null;
  vesselName: string | null;
  voyage: string | null;
  lifecycleApplication: "review_required";
  reviewReasons: TrackingEyesCandidateReviewReason[];
}

export type TrackingEyesNormalizationResult =
  | {
      kind: "candidate";
      candidate: TrackingEyesEventCandidate;
    }
  | {
      kind: "review_required";
      reasonCode:
        | "EXTERNAL_CODE_UNMAPPED"
        | "EXTERNAL_EVENT_TIME_ZONE_REQUIRED"
        | "EXTERNAL_EVENT_RELATION_REVIEW_REQUIRED";
      provider: typeof TRACKINGEYES_PROVIDER;
      context: typeof TRACKINGEYES_OCEAN_CONTEXT;
      containerNumber: string;
      rawCode: string;
      eventTimeRaw: string;
      providerEventId: string | null;
      idempotencyKey: string;
      relationIntent?: "revoke_or_correct";
    }
  | {
      kind: "rejected";
      reasonCode:
        | "VALIDATION_FORMAT"
        | "IDEMPOTENCY_KEY_REQUIRED"
        | "EXTERNAL_DATA_STATE_UNSUPPORTED";
      message: string;
    };

export function normalizeTrackingEyesContainerStatus(
  input: TrackingEyesContainerStatusInput,
): TrackingEyesNormalizationResult {
  const providerEventId = optionalTrimmed(input.providerEventId);
  const localKey = optionalTrimmed(input.localKey);
  const containerNumber = input.containerNumber.trim();
  const rawCode = input.rawCode.trim();
  const eventTimeRaw = input.eventTime.trim();
  const sourceCodeRaw = input.sourceCode.trim();

  if (!containerNumber || !rawCode || !eventTimeRaw) {
    return rejected("VALIDATION_FORMAT", "货柜号、事件码和事件时间不能为空");
  }
  if (providerEventId && !PROVIDER_EVENT_ID.test(providerEventId)) {
    return rejected("VALIDATION_FORMAT", "供应商事件 ID 格式非法");
  }
  if (
    input.dataState !== undefined &&
    !(["add", "update", "delete"] as const).includes(input.dataState)
  ) {
    return rejected("EXTERNAL_DATA_STATE_UNSUPPORTED", "供应商数据状态未注册");
  }

  const payloadHash = optionalTrimmed(input.payloadHash);
  const reviewIdempotencyKey = buildIdempotencyKey({
    providerEventId,
    localKey,
    rawCode,
    eventTimeKey: eventTimeRaw,
    payloadHash,
  });
  if (!reviewIdempotencyKey) {
    return rejected(
      "IDEMPOTENCY_KEY_REQUIRED",
      "缺少供应商事件 ID、localKey 组合键或合法载荷哈希",
    );
  }

  if (!TIME_WITH_OFFSET.test(eventTimeRaw)) {
    return reviewRequired({
      providerEventId,
      idempotencyKey: reviewIdempotencyKey,
      containerNumber,
      rawCode,
      eventTimeRaw,
      reasonCode: "EXTERNAL_EVENT_TIME_ZONE_REQUIRED",
    });
  }
  const occurredAt = new Date(eventTimeRaw);
  if (Number.isNaN(occurredAt.getTime())) {
    return rejected("VALIDATION_FORMAT", "事件时间不是有效的 ISO 8601 时间");
  }

  const idempotencyKey = buildIdempotencyKey({
    providerEventId,
    localKey,
    rawCode,
    eventTimeKey: occurredAt.toISOString(),
    payloadHash,
  });
  if (!idempotencyKey)
    return rejected("IDEMPOTENCY_KEY_REQUIRED", "幂等键生成失败");

  if (input.dataState === "delete") {
    if (!providerEventId) {
      return rejected(
        "IDEMPOTENCY_KEY_REQUIRED",
        "删除动态必须携带原供应商事件 ID",
      );
    }
    return reviewRequired({
      providerEventId,
      idempotencyKey,
      containerNumber,
      rawCode,
      eventTimeRaw,
      reasonCode: "EXTERNAL_EVENT_RELATION_REVIEW_REQUIRED",
      relationIntent: "revoke_or_correct",
    });
  }

  const eventCode = lookupEventCode(rawCode);
  if (!eventCode) {
    return reviewRequired({
      providerEventId,
      idempotencyKey,
      containerNumber,
      rawCode,
      eventTimeRaw,
      reasonCode: "EXTERNAL_CODE_UNMAPPED",
    });
  }

  const sourceSignal = sourceSignalFor(sourceCodeRaw);
  const reviewReasons: TrackingEyesCandidateReviewReason[] = [
    "mapping_pending_provider_validation",
    "source_authority_policy_required",
  ];
  if (input.isEstimate) reviewReasons.push("estimated_event");
  if (sourceSignal === "provider_computed") {
    reviewReasons.push("provider_computed");
  }
  if (sourceSignal === "unknown") reviewReasons.push("unknown_source_code");

  return {
    kind: "candidate",
    candidate: {
      provider: TRACKINGEYES_PROVIDER,
      context: TRACKINGEYES_OCEAN_CONTEXT,
      mappingVersion: TRACKINGEYES_OCEAN_MAPPING_VERSION,
      mappingVerification: "pending_provider_validation",
      providerEventId,
      idempotencyKey,
      containerNumber,
      rawCode,
      eventCode,
      eventTimeRaw,
      occurredAt,
      timeKind: input.isEstimate ? "estimated" : "actual",
      sourceCodeRaw,
      sourceSignal,
      placeCode: optionalTrimmed(input.placeCode),
      placeName: optionalTrimmed(input.placeName),
      vesselName: optionalTrimmed(input.vesselName),
      voyage: optionalTrimmed(input.voyage),
      lifecycleApplication: "review_required",
      reviewReasons,
    },
  };
}

function lookupEventCode(rawCode: string): CanonicalEventCode | null {
  return (
    TRACKINGEYES_OCEAN_EVENT_MAP[
      rawCode as keyof typeof TRACKINGEYES_OCEAN_EVENT_MAP
    ] ?? null
  );
}

function sourceSignalFor(sourceCode: string): TrackingEyesSourceSignal {
  if (sourceCode === "1") return "carrier";
  if (sourceCode === "2") return "terminal";
  if (sourceCode === "4") return "provider_computed";
  return "unknown";
}

function buildIdempotencyKey(input: {
  providerEventId: string | null;
  localKey: string | null;
  rawCode: string;
  eventTimeKey: string;
  payloadHash: string | null;
}): string | null {
  if (input.providerEventId) {
    return `${TRACKINGEYES_PROVIDER}:event:${input.providerEventId}`;
  }
  if (input.localKey) {
    return [
      TRACKINGEYES_PROVIDER,
      "local",
      input.localKey,
      input.rawCode,
      input.eventTimeKey,
    ].join(":");
  }
  if (input.payloadHash && SHA256.test(input.payloadHash)) {
    return `${TRACKINGEYES_PROVIDER}:payload:${input.payloadHash.toLowerCase()}`;
  }
  return null;
}

function reviewRequired(
  detail: Omit<
    Extract<TrackingEyesNormalizationResult, { kind: "review_required" }>,
    "kind" | "provider" | "context"
  >,
): TrackingEyesNormalizationResult {
  return {
    kind: "review_required",
    provider: TRACKINGEYES_PROVIDER,
    context: TRACKINGEYES_OCEAN_CONTEXT,
    ...detail,
  };
}

function optionalTrimmed(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function rejected(
  reasonCode: Extract<
    TrackingEyesNormalizationResult,
    { kind: "rejected" }
  >["reasonCode"],
  message: string,
): TrackingEyesNormalizationResult {
  return { kind: "rejected", reasonCode, message };
}
