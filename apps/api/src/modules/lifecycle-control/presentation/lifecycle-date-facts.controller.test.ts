import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { LifecycleDateFactsController } from "./lifecycle-date-facts.controller";

const identity = {
  actorId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  capabilities: ["lifecycle.operate", "lifecycle.read"],
};

describe("LifecycleDateFactsController", () => {
  it("人工请求只注入身份与人工渠道，不能自报来源策略已验证", async () => {
    const recordDateFact = {
      execute: vi.fn().mockResolvedValue({
        factId: "33333333-3333-4333-8333-333333333333",
        recordState: "recorded",
        applicationState: "review_required",
        reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
        canonicalEventId: null,
        projectionVersion: 1,
      }),
    };
    const controller = new LifecycleDateFactsController(
      recordDateFact as never,
      { execute: vi.fn() } as never,
    );

    const result = await controller.record(
      "44444444-4444-4444-8444-444444444444",
      {
        nodeCode: "destination_arrival",
        eventCode: "arrived",
        timeKind: "actual",
        occurredAt: "2026-09-18T18:00:00+08:00",
        rawValue: "2026-09-18 18:00",
        sourceUtcOffset: "+08:00",
        authoritySystem: "carrier-a",
        evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
        reasonCode: "manual_backfill",
        expectedVersion: 0,
        idempotencyKey: "manual:arrival:1",
      },
      "trace-1",
      { identity },
    );

    expect(recordDateFact.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: identity.tenantId,
        actorId: identity.actorId,
        ingestionChannel: "manual_ui",
        captureSource: "manual_backfill",
        verificationState: "pending",
        confidenceState: "unknown",
      }),
    );
    expect(result.applicationState).toBe("review_required");
  });

  it("写和读接口声明服务端能力要求", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleDateFactsController.prototype.record,
      ),
    ).toEqual(["lifecycle.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleDateFactsController.prototype.list,
      ),
    ).toEqual(["lifecycle.read"]);
  });
});
