import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { RunPrecheckService } from "./run-precheck.service";

const orderColumn = {
  column: "备货单号",
  fieldCode: "orderNumber",
  confidence: 0.9,
};

function buildRepository(
  rows: { id: string; rowNo: number; values: Record<string, string> }[],
) {
  return {
    findById: vi.fn().mockResolvedValue({
      batch: { mappingSuggestions: [orderColumn] },
      rows,
    }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
}

async function buildService(repository: ReturnType<typeof buildRepository>) {
  const module = await Test.createTestingModule({
    providers: [
      RunPrecheckService,
      { provide: IMPORT_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return { service: module.get(RunPrecheckService), repository };
}

describe("RunPrecheckService", () => {
  it("缺备货单号 → REQ_ORDER blocker，且不转 approved", async () => {
    const repository = buildRepository([
      { id: "r1", rowNo: 1, values: { 备货单号: "SO-1" } },
      { id: "r2", rowNo: 2, values: { 备货单号: "" } },
    ]);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1");

    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].ruleCode).toBe("REQ_ORDER");
    expect(result.blockers[0].rowNo).toBe(2);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("文件内重复备货单号 → DUP_ROW blocker", async () => {
    const repository = buildRepository([
      { id: "r1", rowNo: 1, values: { 备货单号: "SO-1" } },
      { id: "r2", rowNo: 2, values: { 备货单号: "SO-1" } },
    ]);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1");

    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].ruleCode).toBe("DUP_ROW");
  });

  it("无 blocker → 转 approved", async () => {
    const repository = buildRepository([
      { id: "r1", rowNo: 1, values: { 备货单号: "SO-1" } },
      { id: "r2", rowNo: 2, values: { 备货单号: "SO-2" } },
    ]);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1");

    expect(result.blockers).toHaveLength(0);
    expect(repository.updateStatus).toHaveBeenCalledWith("batch1", "approved");
  });
});
