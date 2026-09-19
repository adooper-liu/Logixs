import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { RunPrecheckService } from "./run-precheck.service";

const reviews = [
  { column: "备货单号", fieldCode: "orderNumber" },
  { column: "集装箱号", fieldCode: "containerNumber" },
  { column: "货号", fieldCode: "productNumber" },
  { column: "数量", fieldCode: "shippedQuantity" },
].map((review) => ({
  ...review,
  operatorId: "op1",
  createdAt: new Date("2026-09-16T00:00:00Z"),
}));

function row(
  id: string,
  rowNo: number,
  values: Partial<Record<"备货单号" | "集装箱号" | "货号" | "数量", string>>,
) {
  return {
    id,
    rowNo,
    values: {
      备货单号: "SO-1",
      集装箱号: "MSKU1",
      货号: `SKU-${rowNo}`,
      数量: "10",
      ...values,
    },
  };
}

const ACTUAL_TIME_REVIEWS = [
  ...reviews,
  ["实际清关日期", "customsClearanceActualAt"],
  ["清关状态", "customsClearanceStatus"],
  ["来源系统", "timeSourceSystem"],
  ["权威系统", "timeAuthoritySystem"],
  ["UTC偏移", "timeSourceUtcOffset"],
  ["证据ID", "timeEvidenceRef"],
].map((review) =>
  Array.isArray(review)
    ? {
        column: review[0],
        fieldCode: review[1],
        operatorId: "op1",
        createdAt: new Date("2026-09-16T00:00:00Z"),
      }
    : review,
);

function buildRepository(
  rows: ReturnType<typeof row>[],
  confirmedQuantityUnit: string | null = "piece",
  effectiveReviews = reviews,
) {
  return {
    findById: vi.fn().mockResolvedValue({
      batch: {
        id: "batch1",
        tenantId: "t1",
        status: "confirmed",
        confirmedQuantityUnit,
        mappingSuggestions: [],
      },
      rows,
      reviews: effectiveReviews,
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
  it("同一备货单的不同产品行合法并转 approved", async () => {
    const repository = buildRepository([
      row("r1", 1, { 货号: "SKU-1" }),
      row("r2", 2, { 货号: "SKU-2" }),
    ]);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual([]);
    expect(repository.findById).toHaveBeenCalledWith("batch1", "t1");
    expect(repository.updateStatus).toHaveBeenCalledWith("batch1", "approved");
  });

  it("没有来源单位列或人工确认单位时以 REQ_QTY_UNIT 阻断", async () => {
    const repository = buildRepository([row("r1", 1, {})], null);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "REQ_QTY_UNIT" }),
      ]),
    );
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("同一备货单的非空集装箱号不一致时以 HEADER_CONFLICT 阻断", async () => {
    const repository = buildRepository([
      row("r1", 1, { 集装箱号: "MSKU1" }),
      row("r2", 2, { 集装箱号: "MSKU2" }),
    ]);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual([
      expect.objectContaining({ ruleCode: "HEADER_CONFLICT", rowNo: 2 }),
    ]);
  });

  it("完全相同的业务明细以 DUP_ROW 阻断", async () => {
    const repository = buildRepository([
      row("r1", 1, { 货号: "SKU-1" }),
      row("r2", 2, { 货号: "SKU-1" }),
    ]);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual([
      expect.objectContaining({ ruleCode: "DUP_ROW", rowNo: 2 }),
    ]);
  });

  it("清关完成但缺实际时间时以 ACTUAL_EVIDENCE 阻断", async () => {
    const source = row("r1", 1, {}) as ReturnType<typeof row>;
    Object.assign(source.values, {
      清关状态: "已完成",
      实际清关日期: "",
      来源系统: "legacy-lms",
      权威系统: "customs-authority",
      UTC偏移: "+02:00",
      证据ID: "11111111-1111-4111-8111-111111111111",
    });
    const repository = buildRepository([source], "piece", ACTUAL_TIME_REVIEWS);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "ACTUAL_EVIDENCE" }),
      ]),
    );
  });

  it("实际时间缺来源偏移和证据时明确阻断", async () => {
    const source = row("r1", 1, {}) as ReturnType<typeof row>;
    Object.assign(source.values, {
      清关状态: "已完成",
      实际清关日期: "2026-04-09 22:58:00",
      来源系统: "legacy-lms",
      权威系统: "customs-authority",
      UTC偏移: "",
      证据ID: "",
    });
    const repository = buildRepository([source], "piece", ACTUAL_TIME_REVIEWS);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "TIME_PROVENANCE" }),
        expect.objectContaining({ ruleCode: "ACTUAL_EVIDENCE" }),
      ]),
    );
  });

  it("遗留卸空日期只按推导预计时间接收且缺规则版本时阻断", async () => {
    const derivedReviews = [
      ...reviews,
      ...[
        ["卸空日期", "emptyEstimatedAt"],
        ["来源系统", "timeSourceSystem"],
        ["权威系统", "timeAuthoritySystem"],
        ["UTC偏移", "timeSourceUtcOffset"],
        ["规则版本", "timeDerivationRuleVersion"],
      ].map(([column, fieldCode]) => ({
        column,
        fieldCode,
        operatorId: "op1",
        createdAt: new Date("2026-09-16T00:00:00Z"),
      })),
    ];
    const source = row("r1", 1, {}) as ReturnType<typeof row>;
    Object.assign(source.values, {
      卸空日期: "2026-04-23 09:19:30",
      来源系统: "legacy-lms",
      权威系统: "legacy-lms-derivation",
      UTC偏移: "+02:00",
      规则版本: "",
    });
    const repository = buildRepository([source], "piece", derivedReviews);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual([
      expect.objectContaining({ ruleCode: "DERIVED_NOT_ACTUAL" }),
    ]);
  });

  it("历史批次含混合版式时以单一 LAYOUT_MIXED blocker 阻断", async () => {
    const mixedRows = [
      row("r1", 1, {}),
      row("r2", 2, {
        备货单号: "是否查验",
        集装箱号: "否",
        货号: "",
        数量: "",
      }),
      row("r3", 3, {
        备货单号: "备货单号",
        集装箱号: "备货单号",
        货号: "SO-1",
        数量: "SO-1",
      }),
      row("r4", 4, {
        备货单号: "备货单状态",
        集装箱号: "集装箱号",
        货号: "已出运",
        数量: "MSKU1",
      }),
      row("r5", 5, {
        备货单号: "数量",
        集装箱号: "货号",
        货号: "10",
        数量: "SKU-1",
      }),
    ];
    const repository = buildRepository(mixedRows);
    const { service } = await buildService(repository);

    const result = await service.execute("batch1", "t1");

    expect(result.blockers).toEqual([
      {
        ruleCode: "LAYOUT_MIXED",
        rowNo: 3,
        message: "疑似混合版式，工作表第 4 行起出现纵向字段值区块",
      },
    ]);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });
});
