import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MarketSignalConflictError } from "../domain/market-signal";
import type {
  MarketSignalRecord,
  MarketSignalRepository,
} from "../domain/market-signal.repository";
import { DecideMarketSignalService } from "./decide-market-signal.service";

const signal: MarketSignalRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant-a",
  title: "[合成演练] 当前验证",
  marketCode: null,
  channelCode: null,
  categoryRef: null,
  observedFactSummary: null,
  hypothesis: null,
  currentDestination: "watching",
  ownerTeamCode: "market_intelligence",
  activeValidation: {
    responsibleActorId: "actor-a",
    nextReviewDate: "2026-02-12",
    watchFocus: "确认趋势是否持续两周",
    waitingReason: null,
  },
  version: 2,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-02T00:00:00.000Z"),
};

const command = {
  contractVersion: "market-signal-decision.v1" as const,
  expectedSignalVersion: 2,
  decisionType: "watch" as const,
  nextReviewDate: "2026-02-19",
  watchFocus: "确认客户痛点是否重复",
  idempotencyKey: "watch-2",
};

function setup(decide: MarketSignalRepository["decide"]) {
  const repository = {
    findById: vi.fn().mockResolvedValue(signal),
    decide: vi.fn(decide),
  } as unknown as MarketSignalRepository;
  const evidenceReader = {
    execute: vi.fn().mockResolvedValue({ [signal.id]: ["evidence-now"] }),
  };
  return new DecideMarketSignalService(repository, evidenceReader as never);
}

describe("DecideMarketSignalService", () => {
  it("maps a cross-actor commitment conflict to a stable 409 code", async () => {
    const service = setup(async () => {
      throw new MarketSignalConflictError(
        "MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT",
      );
    });

    const failure = await service
      .execute({
        tenantId: "tenant-a",
        actorId: "actor-b",
        signalId: signal.id,
        command,
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(409);
    expect((failure as HttpException).message).toBe(
      "MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT",
    );
  });

  it("keeps idempotency identity stable when current facts and evidence change", async () => {
    const preparedHashes: string[] = [];
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(signal)
        .mockResolvedValueOnce({
          ...signal,
          observedFactSummary: "后来补充的事实",
        }),
      decide: vi.fn(async (input) => {
        preparedHashes.push(input.prepared.payloadHash);
        return {
          signal,
          evidenceRefs: ["evidence-then"],
          decision: {
            id: "decision-1",
            version: 1,
            decisionType: "watch" as const,
            completion: "completed" as const,
            pendingFieldCodes: [],
          },
          handoff: null,
          duplicate: preparedHashes.length > 1,
        };
      }),
    } as unknown as MarketSignalRepository;
    const evidenceReader = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ [signal.id]: [] })
        .mockResolvedValueOnce({ [signal.id]: ["evidence-now"] }),
    };
    const service = new DecideMarketSignalService(
      repository,
      evidenceReader as never,
    );

    await service.execute({
      tenantId: "tenant-a",
      actorId: "actor-a",
      signalId: signal.id,
      command,
    });
    await service.execute({
      tenantId: "tenant-a",
      actorId: "actor-a",
      signalId: signal.id,
      command,
    });

    expect(preparedHashes[1]).toBe(preparedHashes[0]);
  });

  it("presents a replay with the evidence captured by the original decision", async () => {
    const service = setup(async () => ({
      signal,
      evidenceRefs: ["evidence-then"],
      decision: {
        id: "decision-1",
        version: 1,
        decisionType: "watch",
        completion: "completed",
        pendingFieldCodes: [],
      },
      handoff: null,
      duplicate: true,
    }));

    const result = await service.execute({
      tenantId: "tenant-a",
      actorId: "actor-a",
      signalId: signal.id,
      command,
    });

    expect(result).toMatchObject({
      status: "duplicate",
      signal: { version: 2, evidenceRefs: ["evidence-then"] },
    });
  });
});
