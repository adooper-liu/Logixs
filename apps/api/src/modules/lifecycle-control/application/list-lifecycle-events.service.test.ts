import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { encodeLifecycleEventCursor } from "../domain/lifecycle-event-page";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ListLifecycleEventsService } from "./list-lifecycle-events.service";

function event(id: string, occurredAt: string) {
  return {
    id,
    containerId: "c1",
    eventCode: "departed" as const,
    occurredAt: new Date(occurredAt),
    recordedAt: new Date(occurredAt),
    evidenceRefs: ["ev-1"],
  };
}

async function buildService(overrides?: {
  findContainerBase?: ReturnType<typeof vi.fn>;
  listEvents?: ReturnType<typeof vi.fn>;
}) {
  const repository = {
    findFlowByContainer: vi.fn(),
    ensureFlow: vi.fn(),
    completeNodes: vi.fn(),
    updateCurrentNode: vi.fn(),
    ensureNode: vi.fn(),
    findContainerBase:
      overrides?.findContainerBase ??
      vi.fn().mockResolvedValue({
        tenantId: "t1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "in_transit",
      }),
    findEventByIdempotencyKey: vi.fn(),
    listEvents: overrides?.listEvents ?? vi.fn().mockResolvedValue([]),
    saveEvent: vi.fn(),
    findLatestEventTime: vi.fn(),
    findApplicabilityDecision: vi.fn(),
    applyNodeApplicability: vi.fn(),
  };
  const module = await Test.createTestingModule({
    providers: [
      ListLifecycleEventsService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return {
    service: module.get(ListLifecycleEventsService),
    repository,
  };
}

describe("ListLifecycleEventsService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const { service, repository } = await buildService();
    await expect(service.execute({ containerId: "c1" })).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(repository.listEvents).not.toHaveBeenCalled();
  });

  it("货柜不存在或跨租户 → RESOURCE_NOT_FOUND", async () => {
    const { service, repository } = await buildService({
      findContainerBase: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.execute({ tenantId: "t1", containerId: "missing" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(repository.listEvents).not.toHaveBeenCalled();
  });

  it("跨租户货柜当不存在", async () => {
    const { service, repository } = await buildService({
      findContainerBase: vi.fn().mockResolvedValue({
        tenantId: "other",
        orderNumber: "SO-1",
        containerNumber: null,
        currentStatus: "in_transit",
      }),
    });
    await expect(
      service.execute({ tenantId: "t1", containerId: "c1" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(repository.listEvents).not.toHaveBeenCalled();
  });

  it("cursor 与货柜不一致拒绝", async () => {
    const { service, repository } = await buildService();
    const cursor = encodeLifecycleEventCursor({
      tenantId: "t1",
      containerId: "other",
      occurredAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "evt-1",
    });
    await expect(
      service.execute({ tenantId: "t1", containerId: "c1", cursor }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(repository.listEvents).not.toHaveBeenCalled();
  });

  it("按发生时间倒序分页且不暴露幂等键", async () => {
    const first = event("e1", "2026-09-13T03:00:00.000Z");
    const second = event("e2", "2026-09-12T03:00:00.000Z");
    const third = event("e3", "2026-09-11T03:00:00.000Z");
    const { service } = await buildService({
      listEvents: vi.fn().mockResolvedValue([first, second, third]),
    });
    const page = await service.execute({
      tenantId: "t1",
      containerId: "c1",
      pageSize: "2",
    });
    expect(page.items.map((item) => item.id)).toEqual(["e1", "e2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.pageSize).toBe(2);
    expect(JSON.stringify(page.items)).not.toContain("idempotency");
    expect(page.pageInfo.nextCursor).toBe(
      encodeLifecycleEventCursor({
        tenantId: "t1",
        containerId: "c1",
        occurredAt: second.occurredAt,
        id: second.id,
      }),
    );
  });
});
