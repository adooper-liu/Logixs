import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { encodeDeadLetterCursor } from "../domain/outbox-page";
import { OUTBOX_REPOSITORY } from "../domain/outbox.repository";
import { ListDeadLettersService } from "./list-dead-letters.service";

function summary(id: string, deadLetteredAt: string) {
  return {
    id,
    eventId: id,
    eventType: "stuffed",
    aggregateType: "container",
    aggregateId: "c1",
    payloadRef: `canonical-event/${id}`,
    payloadHash: "a".repeat(64),
    attemptCount: 3,
    lastErrorCode: "unknown_code",
    failureCategory: "unknown_code",
    ownerQueue: "lifecycle-control-outbox",
    deadLetteredAt: new Date(deadLetteredAt),
    occurredAt: new Date("2026-09-12T10:00:00.000Z"),
    causationId: null,
    traceId: "trace-1",
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      ListDeadLettersService,
      { provide: OUTBOX_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(ListDeadLettersService);
}

describe("ListDeadLettersService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const listDeadLetters = vi.fn();
    const service = await buildService({ listDeadLetters });
    await expect(service.execute({})).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(listDeadLetters).not.toHaveBeenCalled();
  });

  it("pageSize 超过 200 拒绝", async () => {
    const listDeadLetters = vi.fn();
    const service = await buildService({ listDeadLetters });
    await expect(
      service.execute({ tenantId: "t1", pageSize: "201" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(listDeadLetters).not.toHaveBeenCalled();
  });

  it("cursor 与租户不一致拒绝，不退回第一页", async () => {
    const listDeadLetters = vi.fn();
    const service = await buildService({ listDeadLetters });
    const cursor = encodeDeadLetterCursor({
      tenantId: "other",
      deadLetteredAt: new Date("2026-09-13T00:00:00.000Z"),
      id: "dl-1",
    });
    await expect(service.execute({ tenantId: "t1", cursor })).rejects.toThrow(
      "VALIDATION_FORMAT",
    );
    expect(listDeadLetters).not.toHaveBeenCalled();
  });

  it("按页返回并给出下一页 cursor", async () => {
    const first = summary("dl-1", "2026-09-13T02:00:00.000Z");
    const second = summary("dl-2", "2026-09-13T01:00:00.000Z");
    const third = summary("dl-3", "2026-09-13T00:00:00.000Z");
    const listDeadLetters = vi.fn().mockResolvedValue([first, second, third]);
    const service = await buildService({ listDeadLetters });
    const page = await service.execute({ tenantId: "t1", pageSize: "2" });
    expect(page.items.map((item) => item.id)).toEqual(["dl-1", "dl-2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.pageSize).toBe(2);
    expect(page.pageInfo.nextCursor).toBe(
      encodeDeadLetterCursor({
        tenantId: "t1",
        deadLetteredAt: second.deadLetteredAt,
        id: second.id,
      }),
    );
    expect(page.projectionVersion).toBe(0);
    expect(listDeadLetters).toHaveBeenCalledWith({
      tenantId: "t1",
      ownerModules: ["lifecycle-control", "shipment-registry"],
      after: undefined,
      take: 3,
    });
  });

  it("损坏 cursor 拒绝", async () => {
    const listDeadLetters = vi.fn();
    const service = await buildService({ listDeadLetters });
    await expect(
      service.execute({ tenantId: "t1", cursor: "not-a-cursor" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(listDeadLetters).not.toHaveBeenCalled();
  });
});
