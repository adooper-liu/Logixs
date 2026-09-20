import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { OceanRoutesController } from "./ocean-routes.controller";

describe("OceanRoutesController", () => {
  it("只从服务端身份注入租户、操作者和人工渠道", async () => {
    const replace = { execute: vi.fn().mockResolvedValue({ version: 1 }) };
    const controller = new OceanRoutesController(
      replace as never,
      { execute: vi.fn() } as never,
    );
    await controller.replace(
      "11111111-1111-4111-8111-111111111111",
      {
        segments: [
          {
            transportMode: "vessel",
            originUnlocode: "CNNGB",
            originTimezone: "Asia/Shanghai",
            destinationLocationType: "port",
            destinationUnlocode: "USLAX",
            destinationTimezone: "America/Los_Angeles",
          },
        ],
        evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
        reasonCode: "booking_confirmed",
        expectedVersion: 0,
        idempotencyKey: "manual:route:1",
      },
      "trace-1",
      {
        identity: {
          tenantId: "33333333-3333-4333-8333-333333333333",
          actorId: "44444444-4444-4444-8444-444444444444",
          capabilities: ["lifecycle.operate"],
        },
      },
    );

    expect(replace.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "33333333-3333-4333-8333-333333333333",
        actorId: "44444444-4444-4444-8444-444444444444",
        ingestionChannel: "manual_ui",
        sourceSystem: "logix.manual",
        traceId: "trace-1",
      }),
    );
  });

  it("写入口要求 lifecycle.operate", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OceanRoutesController.prototype.replace,
      ),
    ).toEqual(["lifecycle.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OceanRoutesController.prototype.getCurrent,
      ),
    ).toEqual(["lifecycle.read"]);
  });
});
