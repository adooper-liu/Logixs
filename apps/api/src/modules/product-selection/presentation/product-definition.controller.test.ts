import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { AdvanceProductDefinitionService } from "../application/advance-product-definition.service";
import type { GetProductDefinitionService } from "../application/get-product-definition.service";
import type { ReleaseProductDefinitionService } from "../application/release-product-definition.service";
import { ProductDefinitionController } from "./product-definition.controller";
import type { ProductDefinitionWriteRequestDto } from "./product-definition.dto";

const WRITE: ProductDefinitionWriteRequestDto = {
  contractVersion: "product-definition-write.v1",
  expectedDefinitionVersion: 0,
  specification: "40HC 折叠宠物推车",
  complianceAssumptions: ["CE"],
  advanceStage: false,
  idempotencyKey: "write-1",
};

describe("ProductDefinitionController", () => {
  it("看要读权限，推进与发布要写权限", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ProductDefinitionController.prototype.get,
      ),
    ).toEqual(["planning.read"]);
    for (const method of ["write", "release"] as const) {
      expect(
        Reflect.getMetadata(
          REQUIRED_CAPABILITIES_KEY,
          ProductDefinitionController.prototype[method],
        ),
      ).toEqual(["planning.draft"]);
    }
  });

  it("推进带上身份里的操作人 —— 负责人只能来自服务端身份", async () => {
    const advanceDefinition = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new ProductDefinitionController(
      {} as GetProductDefinitionService,
      advanceDefinition as unknown as AdvanceProductDefinitionService,
      {} as ReleaseProductDefinitionService,
    );

    await controller.write(
      { identity: { tenantId: "tenant-1", actorId: "product-owner" } },
      "handoff-1",
      WRITE,
    );

    expect(advanceDefinition.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "product-owner",
      initiativeHandoffId: "handoff-1",
      command: WRITE,
    });
  });

  it("发布同样只信服务端身份", async () => {
    const releaseDefinition = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new ProductDefinitionController(
      {} as GetProductDefinitionService,
      {} as AdvanceProductDefinitionService,
      releaseDefinition as unknown as ReleaseProductDefinitionService,
    );

    await controller.release(
      { identity: { tenantId: "tenant-1", actorId: "product-owner" } },
      "handoff-1",
      {
        contractVersion: "product-definition-release.v1",
        expectedDefinitionVersion: 1,
        decision: "release",
        idempotencyKey: "release-1",
      },
    );

    expect(releaseDefinition.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "product-owner",
        initiativeHandoffId: "handoff-1",
      }),
    );
  });

  it("读只传已认证的租户", async () => {
    const getDefinition = { execute: vi.fn().mockResolvedValue(null) };
    const controller = new ProductDefinitionController(
      getDefinition as unknown as GetProductDefinitionService,
      {} as AdvanceProductDefinitionService,
      {} as ReleaseProductDefinitionService,
    );

    await controller.get(
      { identity: { tenantId: "tenant-1", actorId: "x" } },
      "handoff-1",
    );

    expect(getDefinition.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      initiativeHandoffId: "handoff-1",
    });
  });
});
