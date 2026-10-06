import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ProductInitiativeNpiQueuePageV1 } from "@logix/contracts";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeNpiEntryRecord,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { decodeKeysetCursor, encodeKeysetCursor } from "./keyset-cursor";

/**
 * NPI 待办队列：选品交到产品侧的立项，按交接时间倒序。
 *
 * 每条同时给出**不可变快照**与**当前领取状态**（`claim` 为 `null` 就是还没人接）——
 * 这样界面一次拿到"这一票是什么"和"有没有人接"，不必再查一次。
 */
@Injectable()
export class ListNpiQueueService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ProductInitiativeNpiQueuePageV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const pageSize = parsePageSize(input.pageSize);
    const cursor = input.cursor
      ? decodeKeysetCursor(input.cursor, input.tenantId)
      : undefined;
    const rows = await this.repository.listNpiQueue({
      tenantId: input.tenantId,
      ...(cursor ? { after: { createdAt: cursor.at, id: cursor.id } } : {}),
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);

    return {
      contractVersion: "product-initiative-npi-queue.v1",
      items: items.map(toQueueEntry),
      pageSize,
      nextCursor:
        hasNext && last
          ? encodeKeysetCursor(
              input.tenantId,
              last.handoff.createdAt,
              last.handoff.handoffId,
            )
          : null,
    };
  }
}

export function toQueueEntry(
  record: ProductInitiativeNpiEntryRecord,
): ProductInitiativeNpiQueuePageV1["items"][number] {
  return {
    handoff: {
      contractVersion: "product_initiative_handoff.v1",
      handoffId: record.handoff.handoffId,
      version: record.handoff.version,
      initiativeId: record.handoff.initiativeId,
      signalId: record.handoff.signalId,
      marketCode: record.handoff.marketCode,
      userProblem: record.handoff.userProblem,
      objective: record.handoff.objective,
      responsibleActorId: record.handoff.responsibleActorId,
      responsibilityAccepted: record.handoff.responsibilityAccepted,
      receivingTeamOrRole: record.handoff.receivingTeamOrRole,
      resourceDescription: record.handoff.resourceDescription,
      targetDate: dateOnly(record.handoff.targetDate),
      nextDecisionDate: dateOnly(record.handoff.nextDecisionDate),
      nextDecisionQuestion: record.handoff.nextDecisionQuestion,
      unitEconomicsSnapshot: record.handoff.unitEconomicsSnapshot,
      negativeConservativeReason: record.handoff.negativeConservativeReason,
      reviewPoints: record.handoff.reviewPoints,
      evidenceRefs: record.handoff.evidenceRefs,
      createdAt: record.handoff.createdAt.toISOString(),
      idempotencyKey: record.handoff.idempotencyKey,
    },
    claim: record.claim
      ? {
          claimId: record.claim.claimId,
          handoffId: record.claim.handoffId,
          claimVersion: record.claim.claimVersion,
          productOwnerActorId: record.claim.productOwnerActorId,
          claimedAt: record.claim.claimedAt.toISOString(),
        }
      : null,
    initiativeVersion: record.initiativeVersion,
    initiativeDestination: record.initiativeDestination,
  };
}

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 100;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 200) invalid("pageSize");
  return parsed;
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
