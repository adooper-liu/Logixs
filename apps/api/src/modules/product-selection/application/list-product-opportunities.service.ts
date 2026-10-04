import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import type {
  ProductOpportunityPageV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  READ_MARKET_SIGNAL_LIVE,
  type ReadMarketSignalLivePort,
} from "../../market-intelligence";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRecord,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { projectMarketOpportunityResponsibility } from "../domain/product-opportunity";
import {
  mergeHandoffWithSignalLive,
  type SignalLiveFields,
} from "../domain/merge-handoff-with-signal";
import { decodeKeysetCursor, encodeKeysetCursor } from "./keyset-cursor";

const MARKET_SIGNAL_SUBJECT = "market_signal";

@Injectable()
export class ListProductOpportunitiesService {
  constructor(
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly repository: ProductOpportunityRepository,
    @Optional()
    @Inject(READ_MARKET_SIGNAL_LIVE)
    private readonly signalLive: ReadMarketSignalLivePort | null = null,
    @Optional()
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort | null = null,
  ) {}

  async execute(input: {
    tenantId: string;
    signalId?: string;
    responsibilityStatus?: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ProductOpportunityPageV1> {
    if (!input.tenantId)
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    const pageSize = parsePageSize(input.pageSize);
    const cursor = input.cursor
      ? decodeKeysetCursor(input.cursor, input.tenantId)
      : undefined;
    const signalId = parseSignalId(input.signalId);
    const responsibilityStatus = parseResponsibilityStatus(
      input.responsibilityStatus,
    );
    const query = {
      tenantId: input.tenantId,
      ...(signalId ? { signalId } : {}),
      ...(responsibilityStatus ? { responsibilityStatus } : {}),
    };
    const [rows, totalCount] = await Promise.all([
      this.repository.list({
        ...query,
        after: cursor ? { createdAt: cursor.at, id: cursor.id } : undefined,
        take: pageSize + 1,
      }),
      responsibilityStatus || signalId
        ? this.repository.count(query)
        : undefined,
    ]);
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    const liveBySignal = await this.loadLiveFields(
      input.tenantId,
      items.map((row) => row.handoff.signalId),
    );
    return {
      contractVersion: "product-opportunity-page.v1",
      items: items.map((row) =>
        toOpportunityV1(row, liveBySignal.get(row.handoff.signalId) ?? null),
      ),
      pageSize,
      ...(totalCount === undefined ? {} : { totalCount }),
      nextCursor:
        hasNext && last
          ? encodeKeysetCursor(
              input.tenantId,
              new Date(last.handoff.createdAt),
              last.handoff.handoffId,
            )
          : null,
    };
  }

  private async loadLiveFields(
    tenantId: string,
    signalIds: readonly string[],
  ): Promise<Map<string, SignalLiveFields>> {
    const map = new Map<string, SignalLiveFields>();
    if (!this.signalLive || signalIds.length === 0) return map;

    const liveRows = await this.signalLive.execute({ tenantId, signalIds });
    const evidenceBySignal =
      this.evidenceReader != null
        ? await this.evidenceReader.execute({
            tenantId,
            subjectType: MARKET_SIGNAL_SUBJECT,
            subjectIds: [...new Set(signalIds)],
          })
        : {};

    for (const row of liveRows) {
      map.set(row.signalId, {
        marketCode: row.marketCode,
        channelCode: row.channelCode,
        categoryRef: row.categoryRef,
        observedFactSummary: row.observedFactSummary,
        hypothesis: row.hypothesis,
        evidenceRefs: evidenceBySignal[row.signalId] ?? [],
      });
    }
    return map;
  }
}

export function toOpportunityV1(
  row: ProductOpportunityRecord,
  live: SignalLiveFields | null,
): ProductOpportunityV1 {
  const merged = mergeHandoffWithSignalLive(row.handoff, live);
  const base: ProductOpportunityV1 = {
    handoff: merged.display,
    supplementedFieldCodes: merged.supplementedFieldCodes,
    intakeState: row.intakeState,
    intakeVersion: row.intakeVersion,
    assignedActorId: row.assignedActorId,
    responsibility: projectMarketOpportunityResponsibility({
      intakeState: row.intakeState,
      handedOffAt: row.handoff.createdAt,
      assignedActorId: row.assignedActorId,
      claimedAt: row.claimedAt,
      acceptedAt: row.acceptedAt,
    }),
    latestSelectionDecision: row.latestSelectionDecision
      ? {
          ...row.latestSelectionDecision,
          decidedAt: row.latestSelectionDecision.decidedAt.toISOString(),
        }
      : null,
  };
  if (merged.supplementedFieldCodes.length > 0) {
    return { ...base, handoffSnapshot: row.handoff };
  }
  return base;
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 50;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 100) invalid("pageSize");
  return parsed;
}

function parseSignalId(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!UUID_PATTERN.test(value)) invalid("signalId");
  return value.toLowerCase();
}

function parseResponsibilityStatus(
  value: string | undefined,
): "retained_by_market" | "transferred_to_selection" | undefined {
  if (value === undefined || value === "") return undefined;
  if (value !== "retained_by_market" && value !== "transferred_to_selection") {
    invalid("responsibilityStatus");
  }
  return value;
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
