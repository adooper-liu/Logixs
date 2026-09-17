import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { ConfirmMappingsService } from "./confirm-mappings.service";

function buildRepository() {
  return {
    findById: vi.fn().mockResolvedValue({
      batch: { status: "parsed" },
      rows: [
        {
          id: "r1",
          rowNo: 1,
          values: { 备货单号: "SO-1", 产品: "SKU-1", 数量: "1" },
        },
      ],
      reviews: [],
    }),
    saveReviewDecision: vi.fn().mockResolvedValue(undefined),
  };
}

async function buildService(repository: ReturnType<typeof buildRepository>) {
  const module = await Test.createTestingModule({
    providers: [
      ConfirmMappingsService,
      { provide: IMPORT_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(ConfirmMappingsService);
}

describe("ConfirmMappingsService", () => {
  it("保存人工修正后的映射和规范化数量单位", async () => {
    const repository = buildRepository();
    const service = await buildService(repository);

    await service.execute({
      batchId: "b1",
      tenantId: "t1",
      operatorId: "op1",
      quantityUnit: "件",
      reviews: [
        { column: "备货单号", fieldCode: "orderNumber" },
        { column: "产品", fieldCode: "productNumber" },
        { column: "数量", fieldCode: "shippedQuantity" },
      ],
    });

    expect(repository.findById).toHaveBeenCalledWith("b1", "t1");
    expect(repository.saveReviewDecision).toHaveBeenCalledWith(
      "b1",
      "piece",
      expect.arrayContaining([
        expect.objectContaining({
          column: "产品",
          fieldCode: "productNumber",
          operatorId: "op1",
        }),
      ]),
    );
  });

  it("拒绝目录之外的字段码", async () => {
    const repository = buildRepository();
    const service = await buildService(repository);

    await expect(
      service.execute({
        batchId: "b1",
        tenantId: "t1",
        operatorId: "op1",
        quantityUnit: "piece",
        reviews: [{ column: "产品", fieldCode: "unknownField" }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.saveReviewDecision).not.toHaveBeenCalled();
  });
});
