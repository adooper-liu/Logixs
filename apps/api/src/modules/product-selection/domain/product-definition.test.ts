import { describe, expect, it } from "vitest";
import type {
  ProductDefinitionReleaseCommandV1,
  ProductDefinitionWriteCommandV1,
} from "@logix/contracts";
import {
  prepareProductDefinitionRelease,
  prepareProductDefinitionWrite,
  productDefinitionPendingFieldCodes,
  ProductDefinitionConflictError,
  ProductDefinitionValidationError,
  type CurrentProductDefinition,
} from "./product-definition";

const FRESH: CurrentProductDefinition = {
  version: 0,
  npiStage: "evt",
  specification: null,
  complianceAssumptions: [],
  concludedStages: [],
};

const WRITE: ProductDefinitionWriteCommandV1 = {
  contractVersion: "product-definition-write.v1",
  expectedDefinitionVersion: 0,
  specification: "40HC 折叠宠物推车，承重 25kg",
  complianceAssumptions: ["CE", "UN38.3"],
  advanceStage: false,
  idempotencyKey: "write-1",
};

describe("prepareProductDefinitionWrite 边界校验", () => {
  it("拒绝别的契约版本，不用旧命令写新事实", () => {
    expect(() =>
      prepareProductDefinitionWrite(FRESH, "product-owner", {
        ...WRITE,
        contractVersion: "nope" as never,
      }),
    ).toThrow(ProductDefinitionValidationError);
  });

  it("规格为空时明确失败，而不是留一条空定义", () => {
    expect(() =>
      prepareProductDefinitionWrite(FRESH, "product-owner", {
        ...WRITE,
        specification: "   ",
      }),
    ).toThrow(ProductDefinitionValidationError);
  });

  it("空白的合规假设被拒绝，不静默丢掉", () => {
    expect(() =>
      prepareProductDefinitionWrite(FRESH, "product-owner", {
        ...WRITE,
        complianceAssumptions: ["CE", "  "],
      }),
    ).toThrow(ProductDefinitionValidationError);
  });

  it("期望版本与当前不符时冲突，不覆盖别人刚写的", () => {
    expect(() =>
      prepareProductDefinitionWrite(
        { ...FRESH, version: 3 },
        "product-owner",
        WRITE,
      ),
    ).toThrow(ProductDefinitionConflictError);
  });
});

describe("NPI 阶段只能逐级前进", () => {
  it("本阶段结论已登记时才能前进一段", () => {
    const prepared = prepareProductDefinitionWrite(FRESH, "product-owner", {
      ...WRITE,
      conclusion: { text: "功能样机通过", evidenceRefs: [] },
      advanceStage: true,
    });

    expect(prepared.npiStage).toBe("dvt");
    expect(prepared.conclusion).toMatchObject({ stage: "evt" });
    expect(prepared.version).toBe(1);
  });

  it("本阶段没结论就想前进时明确失败，并说明缺哪一段", () => {
    try {
      prepareProductDefinitionWrite(FRESH, "product-owner", {
        ...WRITE,
        advanceStage: true,
      });
      throw new Error("应当失败");
    } catch (error) {
      expect(error).toBeInstanceOf(ProductDefinitionValidationError);
      expect((error as Error).message).toContain("evt_conclusion");
    }
  });

  it("之前已登记过本阶段结论，就不必再写一遍", () => {
    const prepared = prepareProductDefinitionWrite(
      { ...FRESH, version: 1, concludedStages: ["evt"] },
      "product-owner",
      { ...WRITE, expectedDefinitionVersion: 1, advanceStage: true },
    );

    expect(prepared.npiStage).toBe("dvt");
    expect(prepared.conclusion).toBeNull();
  });

  it("量产段不能再前进 —— 它靠发布离开，不靠再推一段", () => {
    expect(() =>
      prepareProductDefinitionWrite(
        {
          version: 4,
          npiStage: "mp",
          specification: "已冻结",
          complianceAssumptions: ["CE"],
          concludedStages: ["evt", "dvt", "pvt"],
        },
        "product-owner",
        { ...WRITE, expectedDefinitionVersion: 4, advanceStage: true },
      ),
    ).toThrow(ProductDefinitionConflictError);
  });

  it("不前进时留在原阶段，只更新规格", () => {
    const prepared = prepareProductDefinitionWrite(
      FRESH,
      "product-owner",
      WRITE,
    );

    expect(prepared.npiStage).toBe("evt");
    expect(prepared.version).toBe(1);
  });
});

describe("缺口按当前阶段现算", () => {
  it("刚开头：缺规格、缺合规假设、缺当前阶段结论", () => {
    expect(productDefinitionPendingFieldCodes(FRESH)).toEqual([
      "specification",
      "compliance_assumptions",
      "evt_conclusion",
    ]);
  });

  it("走到 DVT：不再要求 EVT 结论", () => {
    expect(
      productDefinitionPendingFieldCodes({
        version: 2,
        npiStage: "dvt",
        specification: "已冻结",
        complianceAssumptions: ["CE"],
        concludedStages: ["evt"],
      }),
    ).toEqual(["dvt_conclusion"]);
  });

  it("量产段不再要结论 —— 这里只差发布", () => {
    expect(
      productDefinitionPendingFieldCodes({
        version: 4,
        npiStage: "mp",
        specification: "已冻结",
        complianceAssumptions: ["CE"],
        concludedStages: ["evt", "dvt", "pvt"],
      }),
    ).toEqual([]);
  });
});

describe("prepareProductDefinitionRelease", () => {
  const READY: CurrentProductDefinition = {
    version: 4,
    npiStage: "mp",
    specification: "已冻结",
    complianceAssumptions: ["CE"],
    concludedStages: ["evt", "dvt", "pvt"],
  };
  const RELEASE: ProductDefinitionReleaseCommandV1 = {
    contractVersion: "product-definition-release.v1",
    expectedDefinitionVersion: 4,
    decision: "release",
    idempotencyKey: "release-1",
  };

  it("发布：状态变为已发布，不要求原因", () => {
    const prepared = prepareProductDefinitionRelease(
      READY,
      "product-owner",
      RELEASE,
    );

    expect(prepared).toMatchObject({
      releaseState: "released",
      reason: null,
    });
  });

  it("缺规格或缺合规假设时不许发布，并说明差什么", () => {
    try {
      prepareProductDefinitionRelease(
        { ...READY, specification: null },
        "product-owner",
        RELEASE,
      );
      throw new Error("应当失败");
    } catch (error) {
      expect((error as Error).message).toContain("specification");
    }
  });

  it.each(["evt", "dvt", "pvt"] as const)(
    "%s 阶段不允许发布，即使规格和合规假设齐全",
    (npiStage) => {
      expect(() =>
        prepareProductDefinitionRelease(
          { ...READY, npiStage },
          "product-owner",
          RELEASE,
        ),
      ).toThrow("PRODUCT_DEFINITION_RELEASE_REQUIRES_MP");
    },
  );

  it("暂缓与终止必须说明原因 —— 不写为什么，事后无从复盘", () => {
    for (const decision of ["defer", "terminate"] as const) {
      expect(() =>
        prepareProductDefinitionRelease(READY, "product-owner", {
          ...RELEASE,
          decision,
        }),
      ).toThrow(ProductDefinitionValidationError);
    }
  });

  it("暂缓与终止给了原因就落地，且不产生交接", () => {
    const deferred = prepareProductDefinitionRelease(READY, "product-owner", {
      ...RELEASE,
      decision: "defer",
      reason: "成本超目标，等下一轮议价",
    });

    expect(deferred.releaseState).toBe("deferred");
    expect(deferred.reason).toBe("成本超目标，等下一轮议价");
  });

  it("版本不符时冲突，不覆盖别人的发布", () => {
    expect(() =>
      prepareProductDefinitionRelease(READY, "product-owner", {
        ...RELEASE,
        expectedDefinitionVersion: 3,
      }),
    ).toThrow(ProductDefinitionConflictError);
  });

  it("同一请求产生同一载荷哈希，供幂等比较", () => {
    const first = prepareProductDefinitionRelease(
      READY,
      "product-owner",
      RELEASE,
    );
    const second = prepareProductDefinitionRelease(
      READY,
      "product-owner",
      RELEASE,
    );

    expect(first.payloadHash).toBe(second.payloadHash);
  });
});
