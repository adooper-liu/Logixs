import { describe, expect, it, vi } from "vitest";
import type {
  MarketSignalRecord,
  MarketSignalRepository,
} from "../domain/market-signal.repository";
import { ListMarketSignalsService } from "./list-market-signals.service";

const row: MarketSignalRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant-a",
  title: "验证信号",
  marketCode: null,
  channelCode: null,
  categoryRef: null,
  observedFactSummary: null,
  hypothesis: null,
  currentDestination: "watching" as const,
  ownerTeamCode: "market_intelligence",
  activeValidation: {
    responsibleActorId: "actor-a",
    nextReviewDate: "2026-02-12",
    watchFocus: null,
    waitingReason: null,
  },
  version: 2,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-02T00:00:00.000Z"),
};

function setup(rows: MarketSignalRecord[] = [row]) {
  const repository = {
    list: vi.fn().mockResolvedValue(rows),
    count: vi.fn().mockResolvedValue(rows.length),
  } as unknown as MarketSignalRepository;
  const evidenceReader = {
    execute: vi.fn().mockResolvedValue({}),
  };
  return {
    repository,
    service: new ListMarketSignalsService(repository, evidenceReader as never),
  };
}

describe("ListMarketSignalsService", () => {
  it("binds a watching cursor to tenant, destination and due-date sort", async () => {
    const { repository, service } = setup([
      row,
      { ...row, id: "22222222-2222-4222-8222-222222222222" },
    ]);
    const first = await service.execute({
      tenantId: "tenant-a",
      destination: "watching",
      pageSize: "1",
    });
    expect(first.totalCount).toBe(2);
    expect(first.nextCursor).toBeTypeOf("string");

    const secondSetup = setup([]);
    await secondSetup.service.execute({
      tenantId: "tenant-a",
      destination: "watching",
      cursor: first.nextCursor!,
    });
    expect(secondSetup.repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        destination: "watching",
        after: {
          sort: "watching_due",
          activeValidationDueDate: new Date("2026-02-12T00:00:00.000Z"),
          updatedAt: row.updatedAt,
          id: row.id,
        },
      }),
    );
    expect(repository.count).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      destination: "watching",
    });
  });

  it.each([
    ["unknown destination", { tenantId: "tenant-a", destination: "unknown" }],
    ["empty destination", { tenantId: "tenant-a", destination: "" }],
  ])("rejects %s", async (_name, input) => {
    const { service } = setup();
    await expect(service.execute(input)).rejects.toMatchObject({ status: 400 });
  });

  it("lists selection return requests with a filtered total count", async () => {
    const returnRequest = {
      ...row,
      currentDestination: "selection_return_requested" as const,
      activeValidation: null,
    };
    const { repository, service } = setup([returnRequest]);

    const result = await service.execute({
      tenantId: "tenant-a",
      destination: "selection_return_requested",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.currentDestination).toBe(
      "selection_return_requested",
    );
    expect(result.totalCount).toBe(1);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        destination: "selection_return_requested",
      }),
    );
    expect(repository.count).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      destination: "selection_return_requested",
    });
  });

  it("keeps the pre-upgrade cross-destination list and cursor when destination is omitted", async () => {
    const { repository, service } = setup([
      row,
      { ...row, id: "22222222-2222-4222-8222-222222222222" },
    ]);
    const first = await service.execute({
      tenantId: "tenant-a",
      pageSize: "1",
    });
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a", destination: undefined }),
    );
    expect(repository.count).not.toHaveBeenCalled();
    // 升级前 V1 的 MarketSignalPageV1 / MarketSignalV1 均为 additionalProperties:false。
    expect(Object.keys(first).sort()).toEqual(
      ["contractVersion", "items", "nextCursor", "pageSize"].sort(),
    );
    expect(Object.keys(first.items[0]!).sort()).toEqual(
      [
        "signalId",
        "title",
        "marketCode",
        "channelCode",
        "categoryRef",
        "observedFactSummary",
        "hypothesis",
        "evidenceRefs",
        "currentDestination",
        "ownerTeamCode",
        "version",
        "pendingFieldCodes",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    expect(
      JSON.parse(Buffer.from(first.nextCursor!, "base64url").toString()),
    ).toEqual({
      tenantId: "tenant-a",
      updatedAt: row.updatedAt.toISOString(),
      id: row.id,
    });

    const secondSetup = setup([]);
    await secondSetup.service.execute({
      tenantId: "tenant-a",
      cursor: first.nextCursor!,
    });
    expect(secondSetup.repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: undefined,
        after: { sort: "updated", updatedAt: row.updatedAt, id: row.id },
      }),
    );
    await expect(
      secondSetup.service.execute({
        tenantId: "tenant-a",
        destination: "watching",
        cursor: first.nextCursor!,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ["not base64 json", "%%%"],
    [
      "another tenant",
      Buffer.from(
        JSON.stringify({
          tenantId: "tenant-b",
          destination: "watching",
          sort: "watching_due",
          activeValidationDueDate: null,
          updatedAt: "2026-02-02T00:00:00.000Z",
          id: row.id,
        }),
      ).toString("base64url"),
    ],
    [
      "invalid due date",
      Buffer.from(
        JSON.stringify({
          tenantId: "tenant-a",
          destination: "watching",
          sort: "watching_due",
          activeValidationDueDate: "not-a-date",
          updatedAt: "2026-02-02T00:00:00.000Z",
          id: row.id,
        }),
      ).toString("base64url"),
    ],
    [
      "non-UUID destination id",
      Buffer.from(
        JSON.stringify({
          tenantId: "tenant-a",
          destination: "watching",
          sort: "watching_due",
          activeValidationDueDate: null,
          updatedAt: "2026-02-02T00:00:00.000Z",
          id: "not-a-uuid",
        }),
      ).toString("base64url"),
    ],
    [
      "wrong sort for watching",
      Buffer.from(
        JSON.stringify({
          tenantId: "tenant-a",
          destination: "watching",
          sort: "updated",
          updatedAt: "2026-02-02T00:00:00.000Z",
          id: row.id,
        }),
      ).toString("base64url"),
    ],
  ])("rejects a cursor with %s", async (_name, cursor) => {
    const { repository, service } = setup();
    await expect(
      service.execute({
        tenantId: "tenant-a",
        destination: "watching",
        cursor,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID cursor id in legacy mode", async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        tenantId: "tenant-a",
        updatedAt: "2026-02-02T00:00:00.000Z",
        id: "not-a-uuid",
      }),
    ).toString("base64url");
    const { repository, service } = setup();

    await expect(
      service.execute({ tenantId: "tenant-a", cursor }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("rejects a cursor reused for another destination", async () => {
    const { service } = setup([
      row,
      { ...row, id: "22222222-2222-4222-8222-222222222222" },
    ]);
    const first = await service.execute({
      tenantId: "tenant-a",
      destination: "watching",
      pageSize: "1",
    });

    await expect(
      service.execute({
        tenantId: "tenant-a",
        destination: "needs_decision",
        cursor: first.nextCursor!,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
