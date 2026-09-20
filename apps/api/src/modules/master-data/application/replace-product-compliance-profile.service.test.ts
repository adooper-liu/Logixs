import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { ReplaceProductComplianceProfileCommand } from "../domain/product-compliance-profile";
import {
  PRODUCT_COMPLIANCE_PROFILE_REPOSITORY,
  ProductComplianceProfileIdempotencyConflictError,
  ProductComplianceProfileNotFoundError,
  ProductComplianceProfileVersionConflictError,
} from "../domain/product-compliance-profile.repository";
import { ReplaceProductComplianceProfileService } from "./replace-product-compliance-profile.service";

const command: ReplaceProductComplianceProfileCommand = {
  tenantId: "tenant-a",
  productSkuId: "11111111-1111-4111-8111-111111111111",
  expectedProfileVersion: 0,
  battery: { presenceState: "absent" },
  refrigerant: { presenceState: "unknown" },
  dangerousGoods: { classificationState: "not_regulated" },
  inspectionRequirements: [],
  certificates: [],
  ingestionChannel: "file_import",
  sourceSystem: "approved-import",
  evidenceRefs: ["evidence:profile-1"],
  verificationState: "pending",
  actorId: "import-worker",
  reasonCode: "initial_capture",
  idempotencyKey: "import:profile-1",
};

const record = {
  profileId: "profile-id",
  tenantId: "tenant-a",
  productSkuId: command.productSkuId,
  version: 1,
  battery: {
    presenceState: "absent" as const,
    chemistryCode: null,
    modelNumber: null,
    cellCount: null,
    batteryCount: null,
    wattHours: null,
    lithiumContentGrams: null,
    removable: null,
    packingMode: null,
  },
  refrigerant: {
    presenceState: "unknown" as const,
    refrigerantCode: null,
    chargeQuantity: null,
    chargeUnit: null,
    globalWarmingPotential: null,
    hermeticallySealed: null,
  },
  dangerousGoods: {
    classificationState: "not_regulated" as const,
    unNumber: null,
    properShippingName: null,
    hazardClass: null,
    division: null,
    packingGroup: null,
    marinePollutant: null,
    flashPointCelsius: null,
  },
  inspectionRequirements: [],
  certificates: [],
  ingestionChannel: "file_import" as const,
  sourceSystem: "approved-import",
  evidenceRefs: ["evidence:profile-1"],
  verificationState: "pending" as const,
  actorId: "import-worker",
  reasonCode: "initial_capture",
  createdAt: "2026-09-20T00:00:00.000Z",
};

async function buildService() {
  const repository = {
    replace: vi.fn().mockResolvedValue({ record, duplicate: false }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceProductComplianceProfileService,
      { provide: PRODUCT_COMPLIANCE_PROFILE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return {
    service: module.get(ReplaceProductComplianceProfileService),
    repository,
  };
}

describe("ReplaceProductComplianceProfileService", () => {
  it("归一化后写入并返回公共投影", async () => {
    const { service, repository } = await buildService();

    await expect(service.execute(command)).resolves.toEqual({
      ...record,
      writeState: "recorded",
    });
    expect(repository.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("幂等重放显式返回 duplicate", async () => {
    const { service, repository } = await buildService();
    repository.replace.mockResolvedValueOnce({ record, duplicate: true });

    await expect(service.execute(command)).resolves.toMatchObject({
      profileId: "profile-id",
      writeState: "duplicate",
    });
  });

  it("非法专业字段在进入仓储前失败", async () => {
    const { service, repository } = await buildService();

    await expect(
      service.execute({
        ...command,
        battery: { presenceState: "absent", batteryCount: 1 },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it.each([
    [new ProductComplianceProfileNotFoundError(), NotFoundException],
    [new ProductComplianceProfileVersionConflictError(), ConflictException],
    [new ProductComplianceProfileIdempotencyConflictError(), ConflictException],
  ])("映射稳定仓储错误 %#", async (error, expectedType) => {
    const { service, repository } = await buildService();
    repository.replace.mockRejectedValueOnce(error);

    await expect(service.execute(command)).rejects.toThrow(expectedType);
  });
});
