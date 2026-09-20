import { HttpException, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { LifecycleDateFactRecord } from "../domain/lifecycle-date-fact";
import { LIFECYCLE_DATE_FACT_REPOSITORY } from "../domain/lifecycle-date-fact.repository";
import { APPLY_LIFECYCLE_EVENT_ONCE } from "../apply-lifecycle-event-once.port";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";

function fact(
  id: string,
  occurredAt: string,
  overrides: Partial<LifecycleDateFactRecord> = {},
): LifecycleDateFactRecord {
  return {
    id,
    tenantId: "11111111-1111-4111-8111-111111111111",
    containerId: "22222222-2222-4222-8222-222222222222",
    nodeCode: "origin_departure",
    eventCode: "departed",
    timeKind: "actual",
    occurredAt: new Date(occurredAt),
    rawValue: occurredAt,
    sourceUtcOffset: "+00:00",
    ingestionChannel: "api",
    captureSource: "external_evidence",
    sourceSystem: "provider-adapter",
    authoritySystem: "carrier-a",
    provider: "provider-a",
    interfaceCode: "container.status",
    sourceEventId: id,
    mappingVersion: "v1",
    verificationState: "verified",
    confidenceState: "confirmed",
    validity: "effective",
    authorityPolicyRef: "policy-1:v1",
    evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
    actorId: null,
    reasonCode: null,
    idempotencyKey: `source:${id}`,
    payloadHash: "a".repeat(64),
    supersedesFactId: null,
    isCurrent: true,
    applicationState: "pending_application",
    applicationReasonCode: null,
    canonicalEventId: null,
    projectionVersion: 1,
    traceId: `trace-${id}`,
    receivedAt: new Date("2026-09-18T00:00:01Z"),
    recordedAt: new Date("2026-09-18T00:00:02Z"),
    ...overrides,
  };
}

async function buildService(
  claimed: LifecycleDateFactRecord[],
  apply: ReturnType<typeof vi.fn>,
) {
  const repository = {
    claimPendingApplications: vi.fn().mockResolvedValue(claimed),
    finishClaimedApplication: vi.fn().mockImplementation(async (input) => ({
      ...claimed.find((item) => item.id === input.factId)!,
      applicationState: input.state,
      applicationReasonCode: input.reasonCode,
      canonicalEventId: input.canonicalEventId,
    })),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplayPendingLifecycleDateFactsService,
      { provide: LIFECYCLE_DATE_FACT_REPOSITORY, useValue: repository },
      { provide: APPLY_LIFECYCLE_EVENT_ONCE, useValue: { execute: apply } },
    ],
  }).compile();
  return {
    service: module.get(ReplayPendingLifecycleDateFactsService),
    repository,
  };
}

describe("ReplayPendingLifecycleDateFactsService", () => {
  it("按仓储给出的稳定业务时间顺序逐条重放并使用事实幂等键", async () => {
    const first = fact("fact-1", "2026-09-18T01:00:00Z");
    const second = fact("fact-2", "2026-09-18T02:00:00Z", {
      projectionVersion: 2,
    });
    const apply = vi
      .fn()
      .mockResolvedValueOnce({ canonicalEventId: "event-1" })
      .mockResolvedValueOnce({ canonicalEventId: "event-2" });
    const { service, repository } = await buildService([first, second], apply);

    const result = await service.execute({
      tenantId: first.tenantId,
      containerId: first.containerId,
    });

    expect(apply.mock.calls.map(([item]) => item.idempotencyKey)).toEqual([
      "date-fact:fact-1",
      "date-fact:fact-2",
    ]);
    expect(repository.finishClaimedApplication).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      claimed: 2,
      applied: 2,
      pending: 0,
      rejected: 0,
    });
  });

  it("409/412 保持 pending，永久业务拒绝转 rejected", async () => {
    const first = fact("fact-1", "2026-09-18T01:00:00Z");
    const second = fact("fact-2", "2026-09-18T02:00:00Z");
    const apply = vi
      .fn()
      .mockRejectedValueOnce(
        new HttpException("BUSINESS_STATE_VIOLATION", HttpStatus.CONFLICT),
      )
      .mockRejectedValueOnce(
        new HttpException("EVIDENCE_REQUIRED", HttpStatus.UNPROCESSABLE_ENTITY),
      );
    const { service, repository } = await buildService([first, second], apply);

    const result = await service.execute({
      tenantId: first.tenantId,
      containerId: first.containerId,
    });

    expect(repository.finishClaimedApplication).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: "pending_application" }),
    );
    expect(repository.finishClaimedApplication).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: "rejected" }),
    );
    expect(result).toMatchObject({ pending: 1, rejected: 1 });
  });

  it("规范事件已接收但目标节点仍被阻断时保留真实 pending 原因", async () => {
    const pending = fact("fact-1", "2026-09-18T01:00:00Z");
    const apply = vi.fn().mockResolvedValue({
      canonicalEventId: "event-1",
      pendingNodes: ["origin_departure"],
      pendingReasonCodes: {
        origin_departure: "LIFECYCLE_EVENT_PENDING_NODE_BLOCK",
      },
    });
    const { service, repository } = await buildService([pending], apply);

    const result = await service.execute({
      tenantId: pending.tenantId,
      containerId: pending.containerId,
    });

    expect(repository.finishClaimedApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "pending_application",
        reasonCode: "LIFECYCLE_EVENT_PENDING_NODE_BLOCK",
        canonicalEventId: null,
      }),
    );
    expect(result).toMatchObject({ applied: 0, pending: 1 });
  });

  it("时间倒挂虽然是 409，也按永久业务冲突转 rejected", async () => {
    const conflicted = fact("fact-1", "2026-09-18T01:00:00Z");
    const apply = vi
      .fn()
      .mockRejectedValue(
        new HttpException(
          "LIFECYCLE_TIME_ORDER_CONFLICT: 实际时间倒挂",
          HttpStatus.CONFLICT,
        ),
      );
    const { service, repository } = await buildService([conflicted], apply);

    const result = await service.execute({
      tenantId: conflicted.tenantId,
      containerId: conflicted.containerId,
    });

    expect(repository.finishClaimedApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "rejected",
        reasonCode: "LIFECYCLE_TIME_ORDER_CONFLICT",
      }),
    );
    expect(result).toMatchObject({ rejected: 1, pending: 0 });
  });
});
