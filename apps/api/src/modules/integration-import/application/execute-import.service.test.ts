import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ApplyContainerRecordService } from "../../shipment-registry";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { ExecuteImportService } from "./execute-import.service";

const suggestions = [
  { column: "备货单号", fieldCode: "orderNumber", confidence: 0.9 },
  { column: "箱号", fieldCode: "containerNumber", confidence: 0.9 },
];

function buildModule(overrides: { status?: string; rows?: unknown[] }) {
  const rows = overrides.rows ?? [
    { id: "r1", rowNo: 1, values: { 备货单号: "SO-1", 箱号: "MSKU1" } },
    { id: "r2", rowNo: 2, values: { 备货单号: "", 箱号: "" } },
  ];
  const repository = {
    findById: vi.fn().mockResolvedValue({
      batch: {
        status: overrides.status ?? "approved",
        tenantId: "t1",
        mappingSuggestions: suggestions,
      },
      rows,
    }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    saveRowResults: vi.fn().mockResolvedValue(undefined),
  };
  const applyContainerRecord = {
    execute: vi
      .fn()
      .mockResolvedValue({ containerRecordId: "c1", created: true }),
  };
  return { repository, applyContainerRecord };
}

async function buildService(
  repository: ReturnType<typeof buildModule>["repository"],
  applyContainerRecord: ReturnType<typeof buildModule>["applyContainerRecord"],
) {
  const module = await Test.createTestingModule({
    providers: [
      ExecuteImportService,
      { provide: IMPORT_REPOSITORY, useValue: repository },
      { provide: ApplyContainerRecordService, useValue: applyContainerRecord },
    ],
  }).compile();
  return module.get(ExecuteImportService);
}

describe("ExecuteImportService", () => {
  it("非 approved → 拒绝落账", async () => {
    const { repository, applyContainerRecord } = buildModule({
      status: "confirmed",
    });
    const service = await buildService(repository, applyContainerRecord);

    await expect(service.execute("batch1")).rejects.toThrow(HttpException);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
  });

  it("approved → 逐行落账，缺单号行 failed", async () => {
    const { repository, applyContainerRecord } = buildModule({
      status: "approved",
    });
    const service = await buildService(repository, applyContainerRecord);

    const { results } = await service.execute("batch1");

    expect(results).toHaveLength(2);
    expect(results[0].outcome).toBe("success");
    expect(results[1].outcome).toBe("failed");
    expect(repository.updateStatus).toHaveBeenCalledWith("batch1", "completed");
  });
});
