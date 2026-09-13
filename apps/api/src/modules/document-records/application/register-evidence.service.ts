import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  authorityLevel: string;
  contentRef: string;
  contentHash: string;
  sourceType: string;
  originatorSystem: string;
  authoritySystem: string;
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
    const now = new Date();
    return this.repository.create({
      tenantId: input.tenantId,
      evidenceType: input.evidenceType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      authorityLevel: input.authorityLevel,
      contentRef: input.contentRef.trim(),
      contentHash: input.contentHash,
      source: {
        sourceId: randomUUID(),
        sourceType: input.sourceType,
        originatorSystem: input.originatorSystem.trim(),
        authoritySystem: input.authoritySystem.trim(),
        ingestionChannel: input.ingestionChannel,
        captureSource: input.captureSource,
      },
      receivedAt: now,
      recordedAt: now,
    });
  }
}

function includes(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

function validateRegister(input: RegisterEvidenceInput): void {
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
}
