import type { MarketOpportunityHandoffV1 } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import type {
  ProductOpportunityRecord,
  ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { encodeKeysetCursor } from "./keyset-cursor";
import { decodeKeysetCursor } from "./keyset-cursor";
import { ListProductOpportunitiesService } from "./list-product-opportunities.service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";

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
): ProductOpportunityRecord {
  return {
    handoff: handoff(handoffId, createdAt),
    intakeState: "queued",
    intakeVersion: 1,
    assignedActorId: null,
  };
}

function handoff(
  handoffId: string,
  createdAt: string,
): MarketOpportunityHandoffV1 {
  return {
    contractVersion: "market_opportunity_handoff.v1",
    handoffId,
    version: 1,
    signalId: "bbbbbbbb-0000-4000-8000-000000000001",
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
  };
}
