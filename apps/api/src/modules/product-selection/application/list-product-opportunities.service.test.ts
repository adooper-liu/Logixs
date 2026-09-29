import type { MarketOpportunityHandoffV1 } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import type {
  ProductOpportunityRecord,
  ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { encodeKeysetCursor } from "./keyset-cursor";
import { decodeKeysetCursor } from "./keyset-cursor";
import {
  ListProductOpportunitiesService,
  toOpportunityV1,
} from "./list-product-opportunities.service";
import type { ReadMarketSignalLivePort } from "../../market-intelligence";
import type { ReadEvidenceRefsPort } from "../../document-records";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const SIGNAL_ID = "bbbbbbbb-0000-4000-8000-000000000001";

describe("ListProductOpportunitiesService", () => {
  it("满一页时游标指向本页最后一条，沿用本模块共用的 keyset 游标格式", async () => {
    const rows = [
      record("aaaaaaaa-0000-4000-8000-000000000001", "2026-09-27T03:00:00Z"),
      record("aaaaaaaa-0000-4000-8000-000000000002", "2026-09-27T02:00:00Z"),
      record("aaaaaaaa-0000-4000-8000-000000000003", "2026-09-27T01:00:00Z"),
    ];
    const service = new ListProductOpportunitiesService(repository(rows));

    const page = await service.execute({ tenantId: TENANT, pageSize: "2" });

    expect(page.items.map((item) => item.handoff.handoffId)).toEqual([
      rows[0]!.handoff.handoffId,
      rows[1]!.handoff.handoffId,
    ]);
    expect(page.items[0]!.supplementedFieldCodes).toEqual([]);
    expect(decodeKeysetCursor(page.nextCursor!, TENANT)).toEqual({
      at: new Date("2026-09-27T02:00:00Z"),
      id: rows[1]!.handoff.handoffId,
    });
  });

  it("没有下一页时不给游标", async () => {
    const service = new ListProductOpportunitiesService(
      repository([
        record("aaaaaaaa-0000-4000-8000-000000000001", "2026-09-27T03:00:00Z"),
      ]),
    );

    const page = await service.execute({ tenantId: TENANT, pageSize: "2" });

    expect(page.nextCursor).toBeNull();
  });

  it("游标属于别的租户时明确失败，不接着翻别人的页", async () => {
    const service = new ListProductOpportunitiesService(repository([]));
    const foreign = encodeKeysetCursor(
      OTHER_TENANT,
      new Date("2026-09-27T02:00:00Z"),
      "aaaaaaaa-0000-4000-8000-000000000002",
    );

    await expect(
      service.execute({ tenantId: TENANT, cursor: foreign }),
    ).rejects.toThrow(/VALIDATION_FORMAT: cursor/);
  });

  it("页大小非法时明确失败，不静默改成默认值", async () => {
    const service = new ListProductOpportunitiesService(repository([]));

    await expect(
      service.execute({ tenantId: TENANT, pageSize: "0" }),
    ).rejects.toThrow(/VALIDATION_FORMAT: pageSize/);
    await expect(
      service.execute({ tenantId: TENANT, pageSize: "abc" }),
    ).rejects.toThrow(/VALIDATION_FORMAT: pageSize/);
  });

  it("合并信号后补到工作视图，并保留交接当日快照", async () => {
    const row = record(
      "aaaaaaaa-0000-4000-8000-000000000001",
      "2026-09-27T03:00:00Z",
      {
        marketCode: null,
        pendingFieldCodes: ["market_code", "channel_code"],
      },
    );
    const signalLive: ReadMarketSignalLivePort = {
      execute: async () => [
        {
          signalId: SIGNAL_ID,
          marketCode: "美国",
          channelCode: "Aosom.US",
          categoryRef: null,
          observedFactSummary: null,
          hypothesis: null,
        },
      ],
    };
    const evidence: ReadEvidenceRefsPort = {
      execute: async () => ({ [SIGNAL_ID]: [] }),
      executeDetails: async () => [],
    };
    const service = new ListProductOpportunitiesService(
      repository([row]),
      signalLive,
      evidence,
    );

    const page = await service.execute({ tenantId: TENANT });

    expect(page.items[0]!.handoff.marketCode).toBe("美国");
    expect(page.items[0]!.handoff.channelCode).toBe("Aosom.US");
    expect(page.items[0]!.handoff.pendingFieldCodes).toEqual([]);
    expect(page.items[0]!.supplementedFieldCodes).toEqual([
      "market_code",
      "channel_code",
    ]);
    expect(page.items[0]!.handoffSnapshot?.marketCode).toBeNull();
  });
});

describe("toOpportunityV1", () => {
  it("无后补时不附带 handoffSnapshot", () => {
    const view = toOpportunityV1(
      record("aaaaaaaa-0000-4000-8000-000000000001", "2026-09-27T03:00:00Z"),
      null,
    );
    expect(view.handoffSnapshot).toBeUndefined();
    expect(view.supplementedFieldCodes).toEqual([]);
  });
});

function repository(
  rows: ProductOpportunityRecord[],
): ProductOpportunityRepository {
  return {
    list: async () => rows,
    findByHandoffId: async () => null,
    appendIntake: async () => {
      throw new Error("not used");
    },
  };
}

function record(
  handoffId: string,
  createdAt: string,
  handoffOverrides: Partial<MarketOpportunityHandoffV1> = {},
): ProductOpportunityRecord {
  return {
    handoff: handoff(handoffId, createdAt, handoffOverrides),
    intakeState: "queued",
    intakeVersion: 1,
    assignedActorId: null,
  };
}

function handoff(
  handoffId: string,
  createdAt: string,
  overrides: Partial<MarketOpportunityHandoffV1> = {},
): MarketOpportunityHandoffV1 {
  return {
    contractVersion: "market_opportunity_handoff.v1",
    handoffId,
    version: 1,
    signalId: SIGNAL_ID,
    signalVersion: 2,
    title: "加拿大站宠物出行需求上升",
    recipientQueueCode: "product_selection",
    marketCode: "CA",
    channelCode: null,
    categoryRef: null,
    observedFactSummary: null,
    evidenceRefs: [],
    hypothesis: null,
    opportunityStatement: "验证宠物出行机会是否值得立项。",
    judgmentNote: null,
    pendingFieldCodes: [],
    createdBy: "market-owner",
    createdAt,
    idempotencyKey: `handoff:${handoffId}`,
    ...overrides,
  };
}
