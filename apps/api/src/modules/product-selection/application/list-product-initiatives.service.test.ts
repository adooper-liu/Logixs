import { describe, expect, it } from "vitest";
import type {
  ProductInitiativeRecord,
  ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { encodeKeysetCursor } from "./keyset-cursor";
import { ListProductInitiativesService } from "./list-product-initiatives.service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";

describe("ListProductInitiativesService", () => {
  it("只回列表要用的字段，够岗位分辨「看过但先放着」与「还没看过」", async () => {
    const service = new ListProductInitiativesService(
      repository([
        record({
          handoffId: "aaaaaaaa-0000-4000-8000-000000000001",
          outcome: "defer",
          completion: "pending_completion",
          currentDestination: "needs_decision",
          pendingFieldCodes: ["defer_reason", "compliance_risk"],
        }),
      ]),
    );

    const page = await service.execute({ tenantId: TENANT });

    expect(page.contractVersion).toBe("product-initiative-queue.v1");
    expect(page.items).toEqual([
      {
        handoffId: "aaaaaaaa-0000-4000-8000-000000000001",
        outcome: "defer",
        currentDestination: "needs_decision",
        queueGroup: "standard",
        reconsiderationDate: null,
        pendingFieldCodes: ["defer_reason", "compliance_risk"],
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
    ]);
  });

  it("满一页时游标指向本页最后一条，翻页按游标接着往下", async () => {
    const rows = [
      record({
        initiativeId: "cccccccc-0000-4000-8000-000000000001",
        updatedAt: new Date("2026-09-27T03:00:00Z"),
      }),
      record({
        initiativeId: "cccccccc-0000-4000-8000-000000000002",
        updatedAt: new Date("2026-09-27T02:00:00Z"),
      }),
      record({
        initiativeId: "cccccccc-0000-4000-8000-000000000003",
        updatedAt: new Date("2026-09-27T01:00:00Z"),
      }),
    ];
    const calls: unknown[] = [];
    const service = new ListProductInitiativesService(
      repository(rows, (input) => calls.push(input)),
    );

    const page = await service.execute({ tenantId: TENANT, pageSize: "2" });

    expect(page.items).toHaveLength(2);
    expect(page.pageSize).toBe(2);
    expect(page.nextCursor).toEqual(expect.any(String));

    await service.execute({
      tenantId: TENANT,
      pageSize: "2",
      cursor: page.nextCursor!,
    });
    expect(calls[1]).toEqual(
      expect.objectContaining({
        after: {
          group: "standard",
          reconsiderationDate: null,
          updatedAt: new Date("2026-09-27T02:00:00Z"),
          id: "cccccccc-0000-4000-8000-000000000002",
        },
        take: 3,
      }),
    );
  });

  it("没有下一页时不给游标", async () => {
    const service = new ListProductInitiativesService(repository([record({})]));

    const page = await service.execute({ tenantId: TENANT });

    expect(page.nextCursor).toBeNull();
  });

  it("游标属于别的租户时明确失败", async () => {
    const service = new ListProductInitiativesService(repository([]));

    await expect(
      service.execute({
        tenantId: TENANT,
        cursor: encodeKeysetCursor(
          OTHER_TENANT,
          new Date("2026-09-27T02:00:00Z"),
          "cccccccc-0000-4000-8000-000000000002",
        ),
      }),
    ).rejects.toThrow(/VALIDATION_FORMAT: cursor/);
  });

  it("页大小非法时明确失败，不静默改成默认值", async () => {
    const service = new ListProductInitiativesService(repository([]));

    await expect(
      service.execute({ tenantId: TENANT, pageSize: "0" }),
    ).rejects.toThrow(/VALIDATION_FORMAT: pageSize/);
    await expect(
      service.execute({ tenantId: TENANT, pageSize: "201" }),
    ).rejects.toThrow(/VALIDATION_FORMAT: pageSize/);
  });
});

function repository(
  rows: ProductInitiativeRecord[],
  onList: (input: { take: number; after?: unknown }) => void = () => {},
): ProductInitiativeRepository {
  return {
    currentVersion: async () => 0,
    findByHandoffId: async () => null,
    list: async (input) => {
      onList(input);
      return rows;
    },
    persistDecision: async () => {
      throw new Error("not used");
    },
    takeBackSelectionReturn: async () => {
      throw new Error("not used");
    },
    listNpiQueue: async () => {
      throw new Error("not used");
    },
    findNpiEntry: async () => {
      throw new Error("not used");
    },
    appendClaim: async () => {
      throw new Error("not used");
    },
    findById: async () => {
      throw new Error("not used");
    },
    persistNpiReturn: async () => {
      throw new Error("not used");
    },
  };
}

function record(
  overrides: Partial<ProductInitiativeRecord> = {},
): ProductInitiativeRecord {
  return {
    initiativeId: "cccccccc-0000-4000-8000-000000000001",
    handoffId: "aaaaaaaa-0000-4000-8000-000000000001",
    signalId: "bbbbbbbb-0000-4000-8000-000000000001",
    version: 1,
    outcome: "defer",
    completion: "completed",
    currentDestination: "deferred",
    responsibleActorId: "selector-1",
    responsibilityAccepted: null,
    receivingTeamOrRole: null,
    resourceDescription: null,
    targetDate: null,
    nextDecisionDate: null,
    nextDecisionQuestion: null,
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
    objective: null,
    reviewPoints: [],
    reason: "证据不足",
    pendingFieldCodes: [],
    createdAt: new Date("2026-09-27T00:00:00Z"),
    updatedAt: new Date("2026-09-27T00:00:00Z"),
    ...overrides,
  };
}
