import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import {
  AUTHORITY_LEVELS,
  CAPTURE_SOURCES,
  EVIDENCE_TYPES,
  INGESTION_CHANNELS,
  SOURCE_TYPES,
  SUBJECT_TYPES,
  isContentHash,
  isUuid,
} from "../domain/evidence-rules";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRecord,
  type EvidenceRepository,
} from "../domain/evidence.repository";

export interface RegisterEvidenceInput {
  tenantId: string;
  idempotencyKey?: string;
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  authorityLevel: string;
  contentRef: string;
  contentHash: string;
  sourceType: string;
  originatorSystem: string;
  authoritySystem: string;
  provider?: string;
  providerVersion?: string;
  interfaceCode?: string;
  sourceReference?: string;
  sourceEventId?: string;
  mappingVersion?: string;
  ingestionChannel: string;
  captureSource: string;
}

@Injectable()
export class RegisterEvidenceService {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async execute(input: RegisterEvidenceInput): Promise<EvidenceRecord> {
    if (!input.tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    validateRegister(input);
    const normalized = normalizeRegister(input);
    const existing = await this.repository.findByIdempotencyKey(
      normalized.tenantId,
      normalized.idempotencyKey,
    );
    if (existing) return reuseOrConflict(existing, normalized);

    const now = new Date();
    try {
      return await this.repository.create({
        ...normalized,
        source: { sourceId: randomUUID(), ...normalized.source },
        receivedAt: now,
        recordedAt: now,
      });
    } catch (error) {
      const raced = await this.repository.findByIdempotencyKey(
        normalized.tenantId,
        normalized.idempotencyKey,
      );
      if (raced) return reuseOrConflict(raced, normalized);
      throw error;
    }
  }
}

type NormalizedRegisterEvidence = Omit<
  Parameters<EvidenceRepository["create"]>[0],
  "source" | "receivedAt" | "recordedAt"
> & {
  source: Omit<
    Parameters<EvidenceRepository["create"]>[0]["source"],
    "sourceId"
  >;
};

function normalizeRegister(
  input: RegisterEvidenceInput,
): NormalizedRegisterEvidence {
  const normalized = {
    tenantId: input.tenantId.trim(),
    evidenceType: input.evidenceType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    authorityLevel: input.authorityLevel,
    contentRef: input.contentRef.trim(),
    contentHash: input.contentHash,
    source: {
      sourceType: input.sourceType,
      originatorSystem: input.originatorSystem.trim(),
      authoritySystem: input.authoritySystem.trim(),
      provider: normalizeOptional(input.provider),
      providerVersion: normalizeOptional(input.providerVersion),
      interfaceCode: normalizeOptional(input.interfaceCode),
      sourceReference: normalizeOptional(input.sourceReference),
      sourceEventId: normalizeOptional(input.sourceEventId),
      mappingVersion: normalizeOptional(input.mappingVersion),
      ingestionChannel: input.ingestionChannel,
      captureSource: input.captureSource,
    },
  };
  const supplied = input.idempotencyKey?.trim();
  const idempotencyKey =
    supplied ||
    `evidence:auto:${createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex")}`;
  return { ...normalized, idempotencyKey };
}

function reuseOrConflict(
  existing: EvidenceRecord,
  expected: NormalizedRegisterEvidence,
): EvidenceRecord {
  const same =
    existing.tenantId === expected.tenantId &&
    existing.idempotencyKey === expected.idempotencyKey &&
    existing.evidenceType === expected.evidenceType &&
    existing.subjectType === expected.subjectType &&
    existing.subjectId === expected.subjectId &&
    existing.authorityLevel === expected.authorityLevel &&
    existing.contentRef === expected.contentRef &&
    existing.contentHash === expected.contentHash &&
    existing.source.sourceType === expected.source.sourceType &&
    existing.source.originatorSystem === expected.source.originatorSystem &&
    existing.source.authoritySystem === expected.source.authoritySystem &&
    existing.source.provider === expected.source.provider &&
    existing.source.providerVersion === expected.source.providerVersion &&
    existing.source.interfaceCode === expected.source.interfaceCode &&
    existing.source.sourceReference === expected.source.sourceReference &&
    existing.source.sourceEventId === expected.source.sourceEventId &&
    existing.source.mappingVersion === expected.source.mappingVersion &&
    existing.source.ingestionChannel === expected.source.ingestionChannel &&
    existing.source.captureSource === expected.source.captureSource;
  if (!same) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: 同一证据幂等键对应不同内容",
      HttpStatus.CONFLICT,
    );
  }
  return existing;
}

function includes(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function validateRegister(input: RegisterEvidenceInput): void {
  if (
    input.idempotencyKey !== undefined &&
    (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200)
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: idempotencyKey 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!includes(EVIDENCE_TYPES, input.evidenceType)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未知 evidenceType",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!includes(SUBJECT_TYPES, input.subjectType)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未知 subjectType",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!isUuid(input.subjectId)) {
    throw new HttpException(
      "VALIDATION_FORMAT: subjectId 必须是 UUID",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!includes(AUTHORITY_LEVELS, input.authorityLevel)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未知 authorityLevel",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.contentRef?.trim() || input.contentRef.length > 500) {
    throw new HttpException(
      "VALIDATION_FORMAT: contentRef 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!isContentHash(input.contentHash)) {
    throw new HttpException(
      "VALIDATION_FORMAT: contentHash 必须是 sha256 hex",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!includes(SOURCE_TYPES, input.sourceType)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未知 sourceType",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (
    !input.originatorSystem?.trim() ||
    input.originatorSystem.length > 64 ||
    !input.authoritySystem?.trim() ||
    input.authoritySystem.length > 64
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: originatorSystem/authoritySystem 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!includes(INGESTION_CHANNELS, input.ingestionChannel)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未知 ingestionChannel",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!includes(CAPTURE_SOURCES, input.captureSource)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未知 captureSource",
      HttpStatus.BAD_REQUEST,
    );
  }
  const sourceMetadata = [
    [input.provider, 64, "provider"],
    [input.providerVersion, 64, "providerVersion"],
    [input.interfaceCode, 100, "interfaceCode"],
    [input.sourceReference, 200, "sourceReference"],
    [input.sourceEventId, 200, "sourceEventId"],
    [input.mappingVersion, 100, "mappingVersion"],
  ] as const;
  for (const [value, maxLength, field] of sourceMetadata) {
    if (value !== undefined && (!value.trim() || value.length > maxLength)) {
      throw new HttpException(
        `VALIDATION_FORMAT: ${field} 无效`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  if (
    input.captureSource === "external_evidence" &&
    (!input.provider?.trim() ||
      !input.interfaceCode?.trim() ||
      !input.mappingVersion?.trim())
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: 外部证据缺少 provider/interfaceCode/mappingVersion",
      HttpStatus.BAD_REQUEST,
    );
  }
}
