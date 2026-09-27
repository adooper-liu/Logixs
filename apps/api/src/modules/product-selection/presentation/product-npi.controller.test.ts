import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { ClaimProductInitiativeService } from "../application/claim-product-initiative.service";
import type { ListNpiQueueService } from "../application/list-npi-queue.service";
import { ProductNpiController } from "./product-npi.controller";

const COMMAND = {
  contractVersion: "product-initiative-claim.v1",
  expectedClaimVersion: 0,
  idempotencyKey: "claim-1",
} as const;

describe("ProductNpiController", () => {
  it("待办队列要读权限，领取要写权限", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ProductNpiController.prototype.queue,
      ),
    ).toEqual(["planning.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ProductNpiController.prototype.claim,
      ),
    ).toEqual(["planning.draft"]);
  });

  it("队列只传已认证的租户，不传前端给的租户", async () => {
    const listQueue = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const controller = new ProductNpiController(
      listQueue as unknown as ListNpiQueueService,
      {} as ClaimProductInitiativeService,
    );

    await controller.queue(
      { identity: { tenantId: "tenant-1", actorId: "product-owner" } },
      "20",
      "c-1",
    );

    expect(listQueue.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      pageSize: "20",
      cursor: "c-1",
    });
  });

  it("领取带上身份里的操作人 —— 负责人只能来自服务端身份", async () => {
    const claimInitiative = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new ProductNpiController(
      {} as ListNpiQueueService,
      claimInitiative as unknown as ClaimProductInitiativeService,
    );

    await controller.claim(
      { identity: { tenantId: "tenant-1", actorId: "product-owner" } },
      "handoff-1",
      COMMAND,
    );

    expect(claimInitiative.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "product-owner",
      handoffId: "handoff-1",
      command: COMMAND,
    });
  });
});
