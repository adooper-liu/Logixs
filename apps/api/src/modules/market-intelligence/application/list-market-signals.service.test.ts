import { describe, expect, it, vi } from "vitest";
import type { MarketSignalRepository } from "../domain/market-signal.repository";
import { ListMarketSignalsService } from "./list-market-signals.service";

const row = {
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

function setup(rows = [row]) {
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
    const { repository, service } = setup([row, { ...row, id: "22222222-2222-4222-8222-222222222222" }]);
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
    ["missing destination", { tenantId: "tenant-a" }],
    ["unknown destination", { tenantId: "tenant-a", destination: "unknown" }],
  ])("rejects %s", async (_name, input) => {
    const { service } = setup();
    await expect(service.execute(input)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a cursor reused for another destination", async () => {
    const { service } = setup([row, { ...row, id: "22222222-2222-4222-8222-222222222222" }]);
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
