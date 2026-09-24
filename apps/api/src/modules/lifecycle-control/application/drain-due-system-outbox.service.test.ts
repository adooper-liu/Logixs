import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { OUTBOX_REPOSITORY } from "../domain/outbox.repository";
import { DrainDueOutboxService } from "./drain-due-outbox.service";
import { DrainDueSystemOutboxService } from "./drain-due-system-outbox.service";

function tenantDrain(claimed: number) {
  return {
    rounds: 1,
    emptied: claimed === 0,
    claimed,
    published: claimed,
    retryWait: 0,
    deadLetter: 0,
    leftover: 0,
  };
}

async function buildService(input: {
  listDueTenantIds: ReturnType<typeof vi.fn>;
  drain: ReturnType<typeof vi.fn>;
}) {
  const module = await Test.createTestingModule({
    providers: [
      DrainDueSystemOutboxService,
      {
        provide: OUTBOX_REPOSITORY,
        useValue: { listDueTenantIds: input.listDueTenantIds },
      },
      { provide: DrainDueOutboxService, useValue: { execute: input.drain } },
    ],
  }).compile();
  return module.get(DrainDueSystemOutboxService);
}

describe("DrainDueSystemOutboxService", () => {
  it("服务身份按到期租户逐个排空", async () => {
    const listDueTenantIds = vi.fn().mockResolvedValue(["t1", "t2"]);
    const drain = vi
      .fn()
      .mockResolvedValueOnce(tenantDrain(2))
      .mockResolvedValueOnce(tenantDrain(0));
    const service = await buildService({ listDueTenantIds, drain });
    const result = await service.execute({
      actorType: "service",
      actorId: "service:logix-outbox-publisher",
      maxTenants: 20,
    });
    expect(listDueTenantIds).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerModules: ["lifecycle-control", "shipment-registry"],
        take: 21,
      }),
    );
    expect(drain).toHaveBeenNthCalledWith(1, {
      tenantId: "t1",
      operatorId: "service:logix-outbox-publisher",
      limit: undefined,
      maxRounds: undefined,
    });
    expect(drain).toHaveBeenNthCalledWith(2, {
      tenantId: "t2",
      operatorId: "service:logix-outbox-publisher",
      limit: undefined,
      maxRounds: undefined,
    });
    expect(result.tenants).toBe(2);
    expect(result.emptiedTenants).toBe(1);
    expect(result.leftoverTenants).toBe(false);
    expect(result.claimed).toBe(2);
    expect(result.items.map((item) => item.tenantId)).toEqual(["t1", "t2"]);
  });

  it("超过 maxTenants 标记 leftoverTenants 且不再排空", async () => {
    const listDueTenantIds = vi.fn().mockResolvedValue(["t1", "t2"]);
    const drain = vi.fn().mockResolvedValue(tenantDrain(1));
    const service = await buildService({ listDueTenantIds, drain });
    const result = await service.execute({
      actorType: "service",
      actorId: "service:logix-outbox-publisher",
      maxTenants: 1,
    });
    expect(drain).toHaveBeenCalledTimes(1);
    expect(result.leftoverTenants).toBe(true);
    expect(result.tenants).toBe(1);
  });

  it("用户身份或非法 maxTenants 拒绝且不查库", async () => {
    const listDueTenantIds = vi.fn();
    const drain = vi.fn();
    const service = await buildService({ listDueTenantIds, drain });
    await expect(
      service.execute({
        actorType: "user",
        actorId: "op-1",
      }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    await expect(
      service.execute({
        actorType: "service",
        actorId: "service:logix-outbox-publisher",
        maxTenants: "101",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(listDueTenantIds).not.toHaveBeenCalled();
    expect(drain).not.toHaveBeenCalled();
  });
});
