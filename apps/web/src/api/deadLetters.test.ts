import { afterEach, describe, expect, it, vi } from "vitest";
import { listDeadLetters, replayDeadLetter } from "./deadLetters";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listDeadLetters", () => {
  it("带开发期身份与游标查询", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listDeadLetters({ pageSize: 50, cursor: "c1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/outbox/dead-letters?pageSize=50&cursor=c1",
      {
        headers: {
          "X-Tenant-Id": "dev-tenant",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });
});

describe("replayDeadLetter", () => {
  it("只提交原因、消费者版本和幂等键，不带载荷正文", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        deadLetterId: "dl-1",
        replayedOutboxId: "evt-2",
        replayedEventId: "evt-2",
        applied: true,
        corrected: false,
        targetConsumerVersion: "consumer-v1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await replayDeadLetter("dl-1", {
      reasonCode: "manual_replay",
      targetConsumerVersion: "consumer-v1",
      idempotencyKey: "replay-1",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/outbox/dead-letters/dl-1/replay",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      reasonCode: "manual_replay",
      targetConsumerVersion: "consumer-v1",
      idempotencyKey: "replay-1",
    });
    expect(String(init.body)).not.toContain("payload");
    expect(String(init.body)).not.toContain("service-key");
  });
});
