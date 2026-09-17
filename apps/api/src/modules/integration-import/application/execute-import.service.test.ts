import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ApplyReplenishmentOrderImportService } from "../../shipment-registry";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { ExecuteImportService } from "./execute-import.service";

const reviews = [
  ["备货单号", "orderNumber"],
  ["集装箱号", "containerNumber"],
  ["货号", "productNumber"],
  ["数量", "shippedQuantity"],
].map(([column, fieldCode]) => ({
  column,
  fieldCode,
  operatorId: "op1",
  createdAt: new Date("2026-09-16T00:00:00Z"),
}));

function buildModule(status = "approved") {
  const rows = [
    {
      id: "r1",
      rowNo: 1,
      values: {
        备货单号: "SO-1",
        集装箱号: "MSKU1",
        货号: "SKU-1",
        数量: "10",
      },
    },
    {
      id: "r2",
      rowNo: 2,
      values: {
        备货单号: "SO-1",
        集装箱号: "MSKU1",
        货号: "SKU-2",
        数量: "20",
      },
    },
  ];
  const repository = {
    findById: vi.fn().mockResolvedValue({
      batch: {
        id: "batch1",
        status,
        tenantId: "t1",
        confirmedQuantityUnit: "piece",
        mappingSuggestions: [],
      },
      rows,
      reviews,
    }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    saveRowResults: vi.fn().mockResolvedValue(undefined),
  };
  const applyOrderImport = {
    execute: vi.fn().mockResolvedValue({
      replenishmentOrderId: "o1",
      containerRecordId: "c1",
      created: true,
    }),
  };
  return { repository, applyOrderImport };
}

async function buildService(
  repository: ReturnType<typeof buildModule>["repository"],
  applyOrderImport: ReturnType<typeof buildModule>["applyOrderImport"],
) {
  const module = await Test.createTestingModule({
    providers: [
      ExecuteImportService,
      { provide: IMPORT_REPOSITORY, useValue: repository },
      {
        provide: ApplyReplenishmentOrderImportService,
        useValue: applyOrderImport,
      },
    ],
  }).compile();
  return module.get(ExecuteImportService);
}

describe("ExecuteImportService", () => {
  it("非 approved 批次拒绝落账", async () => {
    const { repository, applyOrderImport } = buildModule("confirmed");
    const service = await buildService(repository, applyOrderImport);

    await expect(service.execute("batch1", "t1")).rejects.toThrow(
      ConflictException,
    );
    expect(applyOrderImport.execute).not.toHaveBeenCalled();
  });

  it("同单多行只调用一次事务写端口且逐行关联同一货柜", async () => {
    const { repository, applyOrderImport } = buildModule();
    const service = await buildService(repository, applyOrderImport);

    const { results } = await service.execute("batch1", "t1");

    expect(applyOrderImport.execute).toHaveBeenCalledTimes(1);
    expect(applyOrderImport.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        orderNumber: "SO-1",
        lines: [
          expect.objectContaining({
            sourceRowId: "r1",
            productNumber: "SKU-1",
          }),
          expect.objectContaining({
            sourceRowId: "r2",
            productNumber: "SKU-2",
          }),
        ],
        timeFacts: [],
      }),
    );
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.containerRecordId === "c1")).toBe(
      true,
    );
  });

  it("事务写端口失败时同一备货单全部来源行失败", async () => {
    const { repository, applyOrderImport } = buildModule();
    applyOrderImport.execute.mockRejectedValueOnce(new Error("rolled back"));
    const service = await buildService(repository, applyOrderImport);

    const { results } = await service.execute("batch1", "t1");

    expect(results.map(({ outcome }) => outcome)).toEqual(["failed", "failed"]);
    expect(results.map(({ detail }) => detail)).toEqual([
      "rolled back",
      "rolled back",
    ]);
  });
});
