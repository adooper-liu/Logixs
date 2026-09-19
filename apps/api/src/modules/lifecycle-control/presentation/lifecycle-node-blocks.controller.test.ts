import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { LifecycleNodeBlocksController } from "./lifecycle-node-blocks.controller";

const identity = {
  actorId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
};

describe("LifecycleNodeBlocksController", () => {
  it("从服务端身份注入租户和操作者", async () => {
    const blockNode = { execute: vi.fn().mockResolvedValue({ applied: true }) };
    const controller = new LifecycleNodeBlocksController(
      blockNode as never,
      { execute: vi.fn() } as never,
    );

    await controller.create(
      "33333333-3333-4333-8333-333333333333",
      {
        block: {
          blockId: "44444444-4444-4444-8444-444444444444",
          blockType: "inspection",
          sourceFactId: "55555555-5555-4555-8555-555555555555",
          occurredAt: "2026-09-20T01:00:00Z",
          nodeInstanceId: "66666666-6666-4666-8666-666666666666",
        },
        expectedVersion: 3,
        idempotencyKey: "block-key-1",
        traceId: "trace-1",
      },
      { identity },
    );

    expect(blockNode.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: identity.tenantId,
        actorId: identity.actorId,
      }),
    );
  });

  it("阻断与解除都要求 lifecycle.operate", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleNodeBlocksController.prototype.create,
      ),
    ).toEqual(["lifecycle.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleNodeBlocksController.prototype.resolve,
      ),
    ).toEqual(["lifecycle.operate"]);
  });
});
