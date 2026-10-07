import { describe, expect, it } from "vitest";
import type { ProductInitiativeDecisionCommandV1 } from "@logix/contracts";
import {
  assertProductInitiativeEvidenceRefs,
  BUSINESS_CASE_DIMENSIONS,
  PRODUCT_INITIATIVE_GATE,
  ProductInitiativeConflictError,
  prepareProductInitiativeDecision as prepareProductInitiativeDecisionDomain,
  prepareSelectionReturnTakeback,
  productInitiativePendingFieldCodes,
  type CurrentProductInitiative,
  type ProductInitiativeDraft,
} from "./product-initiative";

const ACTOR = "selector-1";
const INITIATIVE_ID = "55555555-5555-4555-8555-555555555555";
// 完整的要点集合（5 项）。**门槛只有前 4 项** —— `customer_feedback` 由「售后原声」
// 这类专业要求喂证据，缺了进待补但不阻断立项。所以"齐备"与"过门槛"是两回事。
const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
  "customer_feedback",
] as const;

const NEW_INITIATIVE: CurrentProductInitiative = { version: 0 };

function prepareProductInitiativeDecision(
  current: CurrentProductInitiative,
  actorId: string,
  decision: ProductInitiativeDecisionCommandV1,
  gate = PRODUCT_INITIATIVE_GATE,
  todayUtc = "2026-10-04",
) {
  return prepareProductInitiativeDecisionDomain(
    current,
    actorId,
    decision,
    gate,
    todayUtc,
    { marketCode: "US", channelCode: "amazon", currencyResolution: "active" },
  );
}

describe("productInitiativePendingFieldCodes", () => {
  it("列出目标结果与五面作为缺口", () => {
    expect(productInitiativePendingFieldCodes(emptyDraft())).toEqual([
      "objective",
      ...BUSINESS_CASE_DIMENSIONS,
      "responsibility_commitment",
      "receiving_team_or_role",
      "resource_description",
      "target_date",
      "next_decision_date",
      "next_decision_question",
    ]);
  });

  it("五面只差结论或证据时仍算缺口", () => {
    const draft = completeDraft();
    draft.businessCaseDraft = draft.businessCaseDraft!.map((point) =>
      point.dimensionCode === "value_differentiation"
        ? { ...point, conclusion: null }
        : point,
    );
    draft.businessCaseDraft = draft.businessCaseDraft.map((point) =>
      point.dimensionCode === "commercial_viability"
        ? { ...point, evidenceRefs: [] }
        : point,
    );

    expect(productInitiativePendingFieldCodes(draft)).toEqual([
      "value_differentiation",
      "commercial_viability",
    ]);
  });
});

describe("prepareProductInitiativeDecision 立项", () => {
  it("三态只允许支持投入立项，验证态须注明阻断未知并仅能暂缓", () => {
    const validate = completeCommand();
    validate.businessCaseDraft![0] = {
      ...validate.businessCaseDraft![0]!,
      decision: "validate_before_investment",
      criticalUnknown: "客户规模仍须验证",
    };
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, validate),
    ).toThrowError(/PRODUCT_INITIATIVE_INCOMPLETE: customer_need/);
    const defer = {
      ...validate,
      outcome: "defer" as const,
      validationFocus: "验证客户规模",
      reconsiderationDate: "2026-10-20",
    };
    expect(
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, defer),
    ).toMatchObject({
      businessCaseSnapshot: null,
      businessCaseDraft: expect.arrayContaining([
        {
          dimensionCode: "customer_need",
          decision: "validate_before_investment",
          conclusion: "有依据支持投入",
          evidenceRefs: [evidenceId(0)],
          criticalUnknown: "客户规模仍须验证",
        },
      ]),
    });
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, {
        ...validate,
        outcome: "reject",
      }),
    ).toThrowError(/businessCaseDraft.decision/);
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, {
        ...defer,
        businessCaseDraft: [
          { ...validate.businessCaseDraft![0]!, criticalUnknown: null },
        ],
      }),
    ).toThrowError(/businessCaseDraft.criticalUnknown/);
    const unsupported = completeCommand();
    unsupported.businessCaseDraft![1] = {
      ...unsupported.businessCaseDraft![1]!,
      decision: "does_not_support",
    };
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, unsupported),
    ).toThrowError(/PRODUCT_INITIATIVE_INCOMPLETE: value_differentiation/);
  });

  it("不接受重复维度、伪造状态或非阻断未知；新快照只冻结五面", () => {
    const complete = completeCommand();
    const approved = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      complete,
    );
    expect(
      approved.businessCaseSnapshot?.map((point) => point.dimensionCode),
    ).toEqual(BUSINESS_CASE_DIMENSIONS);
    expect(
      approved.businessCaseSnapshot?.every(
        (point) => point.criticalUnknown === null,
      ),
    ).toBe(true);
    complete.businessCaseDraft![1] = complete.businessCaseDraft![0]!;
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, complete),
    ).toThrowError(/businessCaseDraft.dimensionCode/);
    complete.businessCaseDraft![1] = {
      ...approved.businessCaseSnapshot![1]!,
      criticalUnknown: "仍待确定",
    };
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, complete),
    ).toThrowError(/businessCaseDraft.criticalUnknown/);
  });

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
    expect(prepared.businessCaseSnapshot).toHaveLength(5);
  });

  it("缺项时拒绝立项，并说明还差哪几项", () => {
    const withoutObjective = completeCommand();
    delete withoutObjective.objective;

    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, withoutObjective),
    ).toThrowError(/PRODUCT_INITIATIVE_INCOMPLETE: objective/);
  });

  it("资源承诺缺项时逐项拒绝，且责任人只能绑定认证 actor", () => {
    const incomplete = completeCommand();
    delete incomplete.acceptResponsibility;
    delete incomplete.receivingTeamOrRole;

    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, incomplete),
    ).toThrowError(
      /PRODUCT_INITIATIVE_INCOMPLETE: responsibility_commitment,receiving_team_or_role/,
    );

    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand(),
    );
    expect(prepared).toMatchObject({
      responsibleActorId: ACTOR,
      responsibilityAccepted: true,
      receivingTeamOrRole: "产品开发 / NPI",
      resourceDescription: "结构工程 1 人，采购验证 1 人",
      targetDate: "2026-11-15",
      nextDecisionDate: "2026-10-20",
      nextDecisionQuestion: "是否进入 EVT 打样",
    });
  });

  it("旧四项不再作为新立项门槛，五面缺项不能旁路", () => {
    const command = completeCommand();
    command.reviewPoints = command.reviewPoints.map((point) =>
      point.code === "compliance_risk" ? { ...point, conclusion: null } : point,
    );
    expect(
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, command)
        .businessCaseSnapshot,
    ).toHaveLength(5);
    command.businessCaseDraft = command.businessCaseDraft!.slice(1);
    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, command, []),
    ).toThrowError(/PRODUCT_INITIATIVE_INCOMPLETE: customer_need/);
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
    expect(prepared.pendingFieldCodes).toContain("validation_focus");
    expect(prepared.pendingFieldCodes).toContain("reconsideration_date");
  });

  it.each([
    [
      "验证重点",
      {
        validationFocus: "核实大促后的真实转化",
        reconsiderationDate: undefined,
      },
      "reconsideration_date",
      "validation_focus",
    ],
    [
      "重判日期",
      { validationFocus: undefined, reconsiderationDate: "2026-10-20" },
      "validation_focus",
      "reconsideration_date",
    ],
  ] as const)(
    "暂缓只填%s时保存为待补，不提前关闭",
    (_label, partial, missingCode, presentCode) => {
      const prepared = prepareProductInitiativeDecision(
        NEW_INITIATIVE,
        ACTOR,
        command({ outcome: "defer", ...partial }),
        PRODUCT_INITIATIVE_GATE,
        "2026-10-04",
      );

      expect(prepared.completion).toBe("pending_completion");
      expect(prepared.nextDestination).toBe("needs_decision");
      expect(prepared.reason).toBeNull();
      expect(prepared.pendingFieldCodes).toContain(missingCode);
      expect(prepared.pendingFieldCodes).not.toContain(presentCode);
      expect(prepared.validationFocus).toBe(partial.validationFocus ?? null);
      expect(prepared.reconsiderationDate).toBe(
        partial.reconsiderationDate ?? null,
      );
    },
  );

  it("暂缓填了验证重点和重判日期就成立，并留在选品队列", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({
        outcome: "defer",
        validationFocus: "等大促后重看竞争供给",
        reconsiderationDate: "2026-10-20",
      }),
      PRODUCT_INITIATIVE_GATE,
      "2026-10-04",
    );

    expect(prepared.completion).toBe("completed");
    expect(prepared.nextDestination).toBe("deferred");
    expect(prepared.reason).toBe("等大促后重看竞争供给");
    expect(prepared.validationFocus).toBe("等大促后重看竞争供给");
    expect(prepared.reconsiderationDate).toBe("2026-10-20");
    // 暂缓不改写要点缺口，补齐后仍可再判
    expect(prepared.pendingFieldCodes).toEqual(
      expect.arrayContaining([
        "objective",
        ...BUSINESS_CASE_DIMENSIONS,
        "responsibility_commitment",
        "receiving_team_or_role",
        "resource_description",
        "target_date",
        "next_decision_date",
        "next_decision_question",
        "unitEconomics.currencyCode",
      ]),
    );
  });

  it("暂缓重判日期早于 UTC 当天时明确失败", () => {
    expect(() =>
      prepareProductInitiativeDecision(
        NEW_INITIATIVE,
        ACTOR,
        command({
          outcome: "defer",
          validationFocus: "核实大促转化",
          reconsiderationDate: "2026-10-03",
        }),
        PRODUCT_INITIATIVE_GATE,
        "2026-10-04",
      ),
    ).toThrowError(/VALIDATION_FORMAT: reconsiderationDate/);
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

  it("任一五面不支持投入时不得退回市场，仍可不立项或暂缓修改论证", () => {
    const unsupported = completeCommand();
    unsupported.businessCaseDraft![4] = {
      ...unsupported.businessCaseDraft![4]!,
      decision: "does_not_support",
    };
    const returnCommand = {
      ...unsupported,
      outcome: "return_to_market" as const,
      returnReason: "机会定义成了渠道问题",
      returnBasis: "wrong_direction" as const,
    };

    expect(() =>
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, returnCommand),
    ).toThrowError(/VALIDATION_FORMAT: businessCaseDraft.decision/);

    expect(
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, {
        ...unsupported,
        outcome: "reject",
        rejectReason: "组合代价不支持投入",
      }),
    ).toMatchObject({
      completion: "completed",
      nextDestination: "rejected",
      businessCaseSnapshot: null,
    });
    expect(
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, {
        ...unsupported,
        outcome: "defer",
        validationFocus: "调整组合论证",
        reconsiderationDate: "2026-10-20",
      }),
    ).toMatchObject({
      completion: "completed",
      nextDestination: "deferred",
      businessCaseSnapshot: null,
    });
    expect(
      prepareProductInitiativeDecision(NEW_INITIATIVE, ACTOR, {
        ...returnCommand,
        businessCaseDraft: completeCommand().businessCaseDraft,
      }),
    ).toMatchObject({
      completion: "completed",
      nextDestination: "return_requested",
    });
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
    expect(pending.pendingFieldCodes).toContain("return_basis");

    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({
        outcome: "return_to_market",
        returnReason: "机会定义成了渠道问题",
      }),
    );
    expect(prepared.nextDestination).toBe("needs_decision");
    expect(prepared.completion).toBe("pending_completion");

    const requested = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      command({
        outcome: "return_to_market",
        returnReason: "机会定义成了渠道问题",
        returnBasis: "wrong_direction",
      }),
    );
    expect(requested.nextDestination).toBe("return_requested");
    expect(requested.completion).toBe("completed");
  });
});

describe("prepareProductInitiativeDecision 校验与并发", () => {
  it("期望版本与当前版本不一致时冲突而不是覆盖", () => {
    expect(() =>
      prepareProductInitiativeDecision(
        { version: 3 },
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

describe("assertProductInitiativeEvidenceRefs", () => {
  it("五面证据不属于当前机会时整体拒绝", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand(),
    );
    const available = REVIEW_POINT_CODES.map((_, index) => evidenceId(index));
    prepared.businessCaseDraft[0]!.evidenceRefs = [
      "00000000-0000-4000-8000-000000000099",
    ];
    expect(() =>
      assertProductInitiativeEvidenceRefs(prepared, available),
    ).toThrowError(
      /PRODUCT_INITIATIVE_EVIDENCE_INVALID: 00000000-0000-4000-8000-000000000099/,
    );
  });
  it("合法集合覆盖全部引用时通过", () => {
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand(),
    );

    expect(() =>
      assertProductInitiativeEvidenceRefs(
        prepared,
        REVIEW_POINT_CODES.map((_, index) => evidenceId(index)),
      ),
    ).not.toThrow();
  });

  it("无效引用跨要点排序去重后稳定失败", () => {
    const invalidA = "00000000-0000-4000-8000-000000000091";
    const invalidB = "00000000-0000-4000-8000-000000000092";
    const prepared = prepareProductInitiativeDecision(
      NEW_INITIATIVE,
      ACTOR,
      completeCommand({
        reviewPoints: REVIEW_POINT_CODES.map((code, index) => ({
          code,
          evidenceRefs:
            index === 0
              ? [invalidB, invalidA]
              : index === 1
                ? [invalidB]
                : [evidenceId(index)],
          conclusion: `${code} 的结论`,
        })),
      }),
    );

    expect(() =>
      assertProductInitiativeEvidenceRefs(prepared, [
        evidenceId(0),
        evidenceId(1),
        evidenceId(2),
        evidenceId(3),
        evidenceId(4),
      ]),
    ).toThrowError(
      `PRODUCT_INITIATIVE_EVIDENCE_INVALID: ${invalidA},${invalidB}`,
    );
  });
});

describe("PRODUCT_INITIATIVE_GATE", () => {
  it("旧四项名单仅用于历史兼容，新审批不可绕过五面", () => {
    expect(PRODUCT_INITIATIVE_GATE).toEqual([
      "target_user_and_market",
      "competitive_supply",
      "price_band_and_margin",
      "compliance_risk",
    ]);
    expect(PRODUCT_INITIATIVE_GATE).not.toContain("customer_feedback");
    expect(BUSINESS_CASE_DIMENSIONS).toHaveLength(5);
  });
});

describe("prepareSelectionReturnTakeback", () => {
  it("rejects an unknown contract version before persistence", () => {
    expect(() =>
      prepareSelectionReturnTakeback({
        contractVersion: "market-selection-return-takeback.v2" as never,
        expectedSignalVersion: 2,
        idempotencyKey: "takeback-1",
      }),
    ).toThrowError(/VALIDATION_FORMAT: contractVersion/);
  });

  it("normalizes a valid takeback command", () => {
    expect(
      prepareSelectionReturnTakeback({
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: 2,
        idempotencyKey: " takeback-1 ",
      }),
    ).toEqual({ expectedSignalVersion: 2, idempotencyKey: "takeback-1" });
  });
});

function emptyDraft(): ProductInitiativeDraft {
  return {
    objective: null,
    reviewPoints: [],
    deferReason: null,
    rejectReason: null,
    returnReason: null,
    responsibilityAccepted: false,
    receivingTeamOrRole: null,
    resourceDescription: null,
    targetDate: null,
    nextDecisionDate: null,
    nextDecisionQuestion: null,
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
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
    businessCaseDraft: BUSINESS_CASE_DIMENSIONS.map((dimensionCode, index) => ({
      dimensionCode,
      decision: "supports_investment" as const,
      conclusion: "有依据支持投入",
      evidenceRefs: [evidenceId(index)],
      criticalUnknown: null,
    })),
    deferReason: null,
    rejectReason: null,
    returnReason: null,
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人，采购验证 1 人",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
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
    businessCaseDraft: draft.businessCaseDraft,
    acceptResponsibility: true,
    receivingTeamOrRole: draft.receivingTeamOrRole ?? undefined,
    resourceDescription: draft.resourceDescription ?? undefined,
    targetDate: draft.targetDate ?? undefined,
    nextDecisionDate: draft.nextDecisionDate ?? undefined,
    nextDecisionQuestion: draft.nextDecisionQuestion ?? undefined,
    unitEconomicsDraft: completeUnitEconomicsDraft(),
    ...overrides,
  });
}

function completeUnitEconomicsDraft() {
  const cost = {
    min: "1",
    max: "2",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const scenario = {
    salePrice: { ...cost, min: "20", max: "30" },
    landedCost: cost,
    platformFee: cost,
    fulfillmentFee: cost,
    advertisingCost: cost,
    returnCost: cost,
  };
  return {
    channelCode: "amazon",
    currencyCode: "USD",
    scenarios: { baseline: scenario, conservative: scenario },
  };
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
