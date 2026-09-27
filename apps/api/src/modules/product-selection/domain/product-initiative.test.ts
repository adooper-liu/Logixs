import { describe, expect, it } from "vitest";
import type { ProductInitiativeDecisionCommandV1 } from "@logix/contracts";
import {
  PRODUCT_INITIATIVE_GATE,
  ProductInitiativeConflictError,
  ProductInitiativeValidationError,
  prepareProductInitiativeDecision,
  productInitiativePendingFieldCodes,
  type CurrentProductInitiative,
  type ProductInitiativeDraft,
} from "./product-initiative";

const ACTOR = "selector-1";
const INITIATIVE_ID = "55555555-5555-4555-8555-555555555555";
const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
] as const;

const NEW_INITIATIVE: CurrentProductInitiative = {
  version: 0,
  objective: null,
  reviewPoints: [],
};

describe("productInitiativePendingFieldCodes", () => {
  it("列出目标结果与四项要点作为缺口", () => {
    expect(productInitiativePendingFieldCodes(emptyDraft())).toEqual([
      "objective",
      ...REVIEW_POINT_CODES,
    ]);
  });

  it("要点只差结论时仍算缺口，证据为空也算", () => {
    const draft = completeDraft();
    draft.reviewPoints = draft.reviewPoints.map((point) =>
      point.code === "competitive_supply"
        ? { ...point, conclusion: null }
        : point,
    );
    draft.reviewPoints = draft.reviewPoints.map((point) =>
      point.code === "price_band_and_margin"
        ? { ...point, evidenceRefs: [] }
        : point,
    );

    expect(productInitiativePendingFieldCodes(draft)).toEqual([
      "competitive_supply",
      "price_band_and_margin",
    ]);
  });
});

describe("prepareProductInitiativeDecision 立项", () => {
  it("要点与目标结果齐备时立项成立并交到产品侧", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand(),
    );

    expect(prepared.completion).toBe("completed");
    expect(prepared.nextDestination).toBe("handed_off");
    expect(prepared.pendingFieldCodes).toEqual([]);
    expect(prepared.initiativeId).toBe(INITIATIVE_ID);
    expect(prepared.responsibleActorId).toBe(ACTOR);
    expect(prepared.objective).toBe("把折叠宠物出行包做成可发布版本");
    expect(prepared.reviewPoints).toHaveLength(4);
  });

  it("缺项时拒绝立项，并说明还差哪几项", () => {
    const withoutObjective = completeCommand();
    delete withoutObjective.objective;

    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, withoutObjective),
    ).toThrowError(/PRODUCT_INITIATIVE_INCOMPLETE: objective/);
  });

  it("把某要点移出门槛后，该项缺失不再阻止立项，只作为待补", () => {
    const command = completeCommand();
    command.reviewPoints = command.reviewPoints.map((point) =>
      point.code === "compliance_risk" ? { ...point, conclusion: null } : point,
    );

    // 默认门槛下不能立项
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, command),
    ).toThrowError(ProductInitiativeValidationError);

    // 单一配置处把合规风险降为待补后即可立项
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command,
      REVIEW_POINT_CODES.slice(0, 3),
    );

    expect(prepared.completion).toBe("completed");
    expect(prepared.nextDestination).toBe("handed_off");
    expect(prepared.pendingFieldCodes).toEqual(["compliance_risk"]);
  });
});

describe("prepareProductInitiativeDecision 其余去向", () => {
  it("暂缓缺原因时保存但不关闭，并写明缺原因", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({ outcome: "defer" }),
    );

    expect(prepared.completion).toBe("pending_completion");
    expect(prepared.nextDestination).toBe("needs_decision");
    expect(prepared.pendingFieldCodes).toContain("defer_reason");
  });

  it("暂缓填了原因就成立，并留在选品队列", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({ outcome: "defer", deferReason: "等大促后重看竞争供给" }),
    );

    expect(prepared.completion).toBe("completed");
    expect(prepared.nextDestination).toBe("deferred");
    expect(prepared.reason).toBe("等大促后重看竞争供给");
    // 暂缓不改写要点缺口，补齐后仍可再判
    expect(prepared.pendingFieldCodes).toEqual([
      "objective",
      ...REVIEW_POINT_CODES,
    ]);
  });

  it("不立项缺原因时保存但不关闭", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({ outcome: "reject" }),
    );

    expect(prepared.completion).toBe("pending_completion");
    expect(prepared.nextDestination).toBe("needs_decision");
    expect(prepared.pendingFieldCodes).toContain("reject_reason");
  });

  it("不立项填了原因就关闭", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({ outcome: "reject", rejectReason: "利润空间被平台佣金吃掉" }),
    );

    expect(prepared.completion).toBe("completed");
    expect(prepared.nextDestination).toBe("rejected");
    expect(prepared.pendingFieldCodes).not.toContain("reject_reason");
  });

  it("退回经营团队缺理由时保存但不关闭", () => {
    const pending = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({ outcome: "return_to_market" }),
    );

    expect(pending.completion).toBe("pending_completion");
    expect(pending.nextDestination).toBe("needs_decision");
    expect(pending.pendingFieldCodes).toContain("return_reason");

    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({
        outcome: "return_to_market",
        returnReason: "机会定义成了渠道问题",
      }),
    );
    expect(prepared.nextDestination).toBe("returned_to_market");
    expect(prepared.completion).toBe("completed");
  });
});

describe("prepareProductInitiativeDecision 校验与并发", () => {
  it("期望版本与当前版本不一致时冲突而不是覆盖", () => {
    expect(() =>
      prepareProductInitiativeDecision(
        { version: 3, objective: null, reviewPoints: [] },
        ACTOR,
        completeCommand({ expectedInitiativeVersion: 9 }),
      ),
    ).toThrowError(ProductInitiativeConflictError);
  });

  it("未知去向明确失败", () => {
    expect(() =>
      prepareProductInitiativeDecision(
        NEW_INITIATIVE,
        ACTOR,
        command({ outcome: "nope" as never }),
      ),
    ).toThrowError(/VALIDATION_FORMAT: outcome/);
  });

  it("缺幂等键明确失败", () => {
    expect(() =>
      prepareProductInitiativeDecision(
        NEW_INITIATIVE,
        ACTOR,
        completeCommand({ idempotencyKey: "   " }),
      ),
    ).toThrowError(/VALIDATION_FORMAT: idempotencyKey/);
  });

  it("同一输入得到同一幂等载荷指纹", () => {
    const first = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand(),
    );
    const second = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand(),
    );

    expect(first.payloadHash).toBe(second.payloadHash);
    expect(first.payloadHash).toHaveLength(64);
  });
});

describe("PRODUCT_INITIATIVE_GATE", () => {
  it("默认把四项要点都算作立项门槛", () => {
    expect(PRODUCT_INITIATIVE_GATE).toEqual([...REVIEW_POINT_CODES]);
  });
});

function emptyDraft(): ProductInitiativeDraft {
  return {
    objective: null,
    reviewPoints: [],
    deferReason: null,
    rejectReason: null,
    returnReason: null,
  };
}

function completeDraft(): ProductInitiativeDraft {
  return {
    objective: "把折叠宠物出行包做成可发布版本",
    reviewPoints: REVIEW_POINT_CODES.map((code, index) => ({
      code,
      evidenceRefs: [evidenceId(index)],
      conclusion: `${code} 的结论`,
    })),
    deferReason: null,
    rejectReason: null,
    returnReason: null,
  };
}

/** 证据引用是已登记证据的 id，所以按 uuid 形状造样本。 */
function evidenceId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function completeCommand(
  overrides: Partial<ProductInitiativeDecisionCommandV1> = {},
): ProductInitiativeDecisionCommandV1 {
  const draft = completeDraft();
  return command({
    objective: draft.objective ?? undefined,
    reviewPoints: draft.reviewPoints,
    ...overrides,
  });
}

function command(
  overrides: Partial<ProductInitiativeDecisionCommandV1> = {},
): ProductInitiativeDecisionCommandV1 {
  return {
    contractVersion: "product-initiative-decision.v1",
    requestId: INITIATIVE_ID,
    outcome: "approve",
    expectedInitiativeVersion: 0,
    idempotencyKey: "initiative-test",
    reviewPoints: [],
    ...overrides,
  } as ProductInitiativeDecisionCommandV1;
}
