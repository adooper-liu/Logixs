import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { encodeDeadLetterCursor } from "../domain/outbox-page";
import { INBOX_REPOSITORY } from "../domain/inbox.repository";
import { ListInboxDeadLettersService } from "./list-inbox-dead-letters.service";

function summary(id: string, deadLetteredAt: string) {
  return {
    id,
    messageId: id,
    consumerName: "lifecycle-control-inbox",
    payloadRef: `inbox/${id}`,
    payloadHash: "a".repeat(64),
    attemptCount: 3,
    lastErrorCode: "timeout",
    failureCategory: "transient_technical",
    ownerQueue: "lifecycle-control-inbox",
    deadLetteredAt: new Date(deadLetteredAt),
    receivedAt: new Date("2026-09-12T10:00:00.000Z"),
    causationId: null,
    traceId: "trace-1",
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      ListInboxDeadLettersService,
      { provide: INBOX_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(ListInboxDeadLettersService);
}

describe("ListInboxDeadLettersService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const listDeadLetters = vi.fn();
    const service = await buildService({ listDeadLetters });
    await expect(service.execute({})).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(listDeadLetters).not.toHaveBeenCalled();
  });

  it("cursor 与租户不一致拒绝", async () => {
    const listDeadLetters = vi.fn();
    const service = await buildService({ listDeadLetters });
    const cursor = encodeDeadLetterCursor({
      tenantId: "other",
      deadLetteredAt: new Date("2026-09-13T00:00:00.000Z"),
      id: "in-1",
    });
    await expect(service.execute({ tenantId: "t1", cursor })).rejects.toThrow(
      "VALIDATION_FORMAT",
    );
    expect(listDeadLetters).not.toHaveBeenCalled();
  });

  it("按页返回并给出下一页 cursor", async () => {
    const first = summary("in-1", "2026-09-13T02:00:00.000Z");
    const second = summary("in-2", "2026-09-13T01:00:00.000Z");
    const third = summary("in-3", "2026-09-13T00:00:00.000Z");
    const listDeadLetters = vi.fn().mockResolvedValue([first, second, third]);
    const service = await buildService({ listDeadLetters });
    const page = await service.execute({ tenantId: "t1", pageSize: "2" });
    expect(page.items.map((item) => item.id)).toEqual(["in-1", "in-2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.nextCursor).toBe(
      encodeDeadLetterCursor({
        tenantId: "t1",
        deadLetteredAt: second.deadLetteredAt,
        id: second.id,
      }),
    );
    expect(listDeadLetters).toHaveBeenCalledWith({
      tenantId: "t1",
      consumerName: "lifecycle-control-inbox",
      after: undefined,
      take: 3,
    });
  });
});
