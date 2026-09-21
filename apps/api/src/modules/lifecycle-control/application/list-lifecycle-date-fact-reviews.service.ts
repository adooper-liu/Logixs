import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  LifecycleDateFactReviewItem,
  LifecycleDateFactReviewPage,
} from "@logix/contracts";
import {
  READ_EVIDENCE_AUTHORITY_CONTEXT,
  type EvidenceAuthorityContext,
  type ReadEvidenceAuthorityContextPort,
} from "../../document-records";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
import {
  decodeDateReviewCursor,
  encodeDateReviewCursor,
  parseDateReviewPageSize,
} from "../domain/lifecycle-date-review-page";

@Injectable()
export class ListLifecycleDateFactReviewsService {
  constructor(
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly repository: LifecycleDateFactRepository,
    @Inject(READ_EVIDENCE_AUTHORITY_CONTEXT)
    private readonly readEvidence: ReadEvidenceAuthorityContextPort,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<LifecycleDateFactReviewPage> {
    if (!input.tenantId?.trim() || !input.actorId?.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED",
        HttpStatus.FORBIDDEN,
      );
    }
    let pageSize: number;
    let after: { recordedAt: Date; id: string } | undefined;
    try {
      pageSize = parseDateReviewPageSize(input.pageSize);
      if (input.cursor) {
        const cursor = decodeDateReviewCursor(input.cursor);
        if (cursor.tenantId !== input.tenantId) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { recordedAt: cursor.recordedAt, id: cursor.id };
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.repository.listReviewRequired({
      tenantId: input.tenantId,
      after,
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
    const items = await Promise.all(
      pageRows.map(async (row) => {
        const evidence = await this.readEvidence.execute({
          tenantId: input.tenantId,
          subjectType: "container",
          subjectId: row.fact.containerId,
          evidenceIds: row.fact.evidenceRefs,
        });
        return toReviewItem(row, evidence, input.actorId);
      }),
    );
    const last = pageRows.at(-1)?.fact;
    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeDateReviewCursor({
                tenantId: input.tenantId,
                recordedAt: last.recordedAt,
                id: last.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date().toISOString(),
    };
  }
}

function toReviewItem(
  row: Awaited<
    ReturnType<LifecycleDateFactRepository["listReviewRequired"]>
  >[number],
  evidence: EvidenceAuthorityContext[],
  reviewerId: string,
): LifecycleDateFactReviewItem {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const evidenceItems = row.fact.evidenceRefs.map((id) => {
    const item = byId.get(id);
    return {
      evidenceId: id,
      evidenceType: item?.evidenceType ?? "missing",
      verificationState: item?.verificationState ?? "pending",
      validity: item?.validity ?? "revoked",
      qualified:
        item?.verificationState === "verified" && item.validity === "effective",
    } as LifecycleDateFactReviewItem["evidence"][number];
  });
  const blockingReasons = [
    ...(row.fact.actorId === reviewerId ? ["SELF_REVIEW_NOT_ALLOWED"] : []),
    ...(!row.fact.actorId ? ["SUBMITTER_IDENTITY_MISSING"] : []),
    ...(evidenceItems.length === 0 ? ["EVIDENCE_REQUIRED"] : []),
    ...(evidenceItems.some((item) => !item.qualified)
      ? ["EVIDENCE_NOT_QUALIFIED"]
      : []),
  ];
  return {
    factId: row.fact.id,
    containerId: row.fact.containerId,
    orderNumber: row.orderNumber,
    containerNumber: row.containerNumber,
    nodeCode: row.fact.nodeCode,
    eventCode: row.fact.eventCode,
    occurredAt: row.fact.occurredAt.toISOString(),
    rawValue: row.fact.rawValue,
    sourceUtcOffset: row.fact.sourceUtcOffset,
    captureSource: row.fact.captureSource,
    sourceSystem: row.fact.sourceSystem,
    authoritySystem: row.fact.authoritySystem,
    location: row.fact.location,
    submittedBy: row.fact.actorId,
    recordedAt: row.fact.recordedAt.toISOString(),
    projectionVersion: row.currentProjectionVersion,
    evidence: evidenceItems,
    blockingReasons: [...new Set(blockingReasons)],
    allowedActions: blockingReasons.length === 0 ? ["approve"] : [],
  };
}
