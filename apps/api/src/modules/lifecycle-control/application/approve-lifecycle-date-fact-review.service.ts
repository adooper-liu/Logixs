import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ApproveLifecycleDateFactReviewCommand,
  LifecycleDateFactResult,
} from "@logix/contracts";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
import { RecordLifecycleDateFactService } from "./record-lifecycle-date-fact.service";

@Injectable()
export class ApproveLifecycleDateFactReviewService {
  constructor(
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly repository: LifecycleDateFactRepository,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidence: AssertEvidenceRefsPort,
    private readonly recordDateFact: RecordLifecycleDateFactService,
  ) {}

  async execute(
    input: ApproveLifecycleDateFactReviewCommand & {
      tenantId: string;
      factId: string;
      reviewerId: string;
      traceId: string;
      actorCapabilities: readonly string[];
    },
  ): Promise<LifecycleDateFactResult> {
    assertCommand(input);
    const current = await this.repository.findById(input.factId);
    if (!current) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (current.tenantId !== input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (
      current.timeKind !== "actual" ||
      current.ingestionChannel !== "manual_ui" ||
      current.applicationState !== "review_required"
    ) {
      throw new HttpException(
        "BUSINESS_PRECONDITION_FAILED: 日期事实已不在待复核状态",
        HttpStatus.CONFLICT,
      );
    }
    if (!current.actorId || current.actorId === input.reviewerId) {
      throw new HttpException(
        "BUSINESS_PRECONDITION_FAILED: 日期事实必须由另一名复核人批准",
        HttpStatus.CONFLICT,
      );
    }
    await this.assertEvidence.execute({
      tenantId: input.tenantId,
      subjectType: "container",
      subjectId: current.containerId,
      evidenceIds: current.evidenceRefs,
    });

    return this.recordDateFact.execute({
      tenantId: current.tenantId,
      containerId: current.containerId,
      nodeCode: current.nodeCode,
      eventCode: current.eventCode,
      timeKind: "actual",
      occurredAt: current.occurredAt.toISOString(),
      rawValue: current.rawValue,
      sourceUtcOffset: current.sourceUtcOffset,
      ingestionChannel: current.ingestionChannel,
      captureSource: current.captureSource,
      sourceSystem: current.sourceSystem,
      authoritySystem: current.authoritySystem,
      provider: current.provider ?? undefined,
      interfaceCode: current.interfaceCode ?? undefined,
      sourceEventId: current.sourceEventId ?? undefined,
      mappingVersion: current.mappingVersion ?? undefined,
      verificationState: "verified",
      confidenceState: "confirmed",
      validity: "effective",
      location: current.location ?? undefined,
      evidenceRefs: current.evidenceRefs,
      actorId: input.reviewerId,
      reasonCode: input.reasonCode,
      expectedVersion: input.expectedVersion,
      supersedesFactId: current.id,
      idempotencyKey: input.idempotencyKey,
      traceId: input.traceId,
      actorCapabilities: input.actorCapabilities,
    });
  }
}

function assertCommand(input: {
  tenantId: string;
  reviewerId: string;
  factId: string;
  reasonCode: string;
  expectedVersion: number;
  idempotencyKey: string;
  traceId: string;
}): void {
  if (!input.tenantId?.trim() || !input.reviewerId?.trim()) {
    throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
  }
  if (
    !input.factId?.trim() ||
    !input.reasonCode?.trim() ||
    input.reasonCode.length > 64 ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.idempotencyKey?.trim() ||
    input.idempotencyKey.length > 200 ||
    !input.traceId?.trim()
  ) {
    throw new HttpException("VALIDATION_FORMAT", HttpStatus.BAD_REQUEST);
  }
}
