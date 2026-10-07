import { createHash } from "node:crypto";
import type {
  ProductInitiativeCompletionV1,
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeDestinationV1,
  ProductInitiativeOutcomeV1,
  ProductInitiativePendingFieldCodeV1,
  ProductInitiativeReturnBasisV1,
  ProductInitiativeReviewPointCodeV1,
  ProductInitiativeBusinessCaseDimensionCodeV1,
  ProductInitiativeBusinessCaseDimensionDraftV1,
  ProductInitiativeV1,
  ProductInitiativeUnitEconomicsDraftV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
  MarketSelectionReturnTakebackCommandV1,
} from "@logix/contracts";
import {
  prepareProductInitiativeUnitEconomics,
  type ProductInitiativeUnitEconomicsContext,
} from "./unit-economics";

export interface ProductInitiativeReviewPoint {
  code: ProductInitiativeReviewPointCodeV1;
  /** 引用已登记证据的 id；事实不在本聚合里另存一份。 */
  evidenceRefs: string[];
  conclusion: string | null;
}

export interface ProductInitiativeDraft {
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  businessCaseDraft?: ProductInitiativeBusinessCaseDimensionDraftV1[];
  deferReason: string | null;
  rejectReason: string | null;
  returnReason: string | null;
  returnBasis?: ProductInitiativeReturnBasisV1 | null;
  responsibilityAccepted: boolean;
  receivingTeamOrRole: string | null;
  resourceDescription: string | null;
  targetDate: string | null;
  nextDecisionDate: string | null;
  nextDecisionQuestion: string | null;
  validationFocus: string | null;
  reconsiderationDate: string | null;
  unitEconomicsDraft: ProductInitiativeUnitEconomicsDraftV1 | null;
  unitEconomicsSnapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  negativeConservativeReason: string | null;
}

/** 该机会上已存在的立项判断版本；0 表示还没有立项判断。 */
export interface CurrentProductInitiative {
  version: number;
}

export interface PreparedProductInitiativeDecision {
  expectedVersion: number;
  initiativeId: string;
  outcome: ProductInitiativeOutcomeV1;
  completion: ProductInitiativeCompletionV1;
  nextDestination: ProductInitiativeDestinationV1;
  /** 立项责任人 = 操作人；产品负责人要到 NPI 领取时才产生。 */
  responsibleActorId: string;
  responsibilityAccepted: boolean | null;
  receivingTeamOrRole: string | null;
  resourceDescription: string | null;
  targetDate: string | null;
  nextDecisionDate: string | null;
  nextDecisionQuestion: string | null;
  validationFocus: string | null;
  reconsiderationDate: string | null;
  unitEconomicsDraft: ProductInitiativeUnitEconomicsDraftV1 | null;
  unitEconomicsSnapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  negativeConservativeReason: string | null;
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  businessCaseDraft: ProductInitiativeBusinessCaseDimensionDraftV1[];
  businessCaseSnapshot: ProductInitiativeV1["businessCaseSnapshot"];
  reason: string | null;
  returnBasis: ProductInitiativeReturnBasisV1 | null;
  pendingFieldCodes: ProductInitiativePendingFieldCodeV1[];
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedSelectionReturnTakeback {
  expectedSignalVersion: number;
  idempotencyKey: string;
}

export class ProductInitiativeValidationError extends Error {}
export class ProductInitiativeConflictError extends Error {}
export class ProductInitiativeNotFoundError extends Error {}

export function prepareSelectionReturnTakeback(
  command: MarketSelectionReturnTakebackCommandV1,
): PreparedSelectionReturnTakeback {
  if (command.contractVersion !== "market-selection-return-takeback.v1") {
    invalid("contractVersion");
  }
  const expectedSignalVersion = version(command.expectedSignalVersion);
  if (expectedSignalVersion < 1) invalid("expectedSignalVersion");
  return {
    expectedSignalVersion,
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
}

export const PRODUCT_INITIATIVE_GATE: readonly ProductInitiativeReviewPointCodeV1[] =
  [
    "target_user_and_market",
    "competitive_supply",
    "price_band_and_margin",
    "compliance_risk",
  ];

export function productInitiativePendingFieldCodes(
  draft: ProductInitiativeDraft,
  decision?: {
    outcome: ProductInitiativeOutcomeV1;
    deferReason: string | null;
    rejectReason: string | null;
    returnReason: string | null;
    returnBasis: ProductInitiativeReturnBasisV1 | null;
  },
): ProductInitiativePendingFieldCodeV1[] {
  const missing = new Set<ProductInitiativePendingFieldCodeV1>();
  if (!draft.objective) missing.add("objective");
  if (!draft.responsibilityAccepted) missing.add("responsibility_commitment");
  if (!draft.receivingTeamOrRole) missing.add("receiving_team_or_role");
  if (!draft.resourceDescription) missing.add("resource_description");
  if (!draft.targetDate) missing.add("target_date");
  if (!draft.nextDecisionDate) missing.add("next_decision_date");
  if (!draft.nextDecisionQuestion) missing.add("next_decision_question");
  for (const code of BUSINESS_CASE_DIMENSIONS) {
    const point = draft.businessCaseDraft?.find(
      (item) => item.dimensionCode === code,
    );
    if (
      !point ||
      !point.decision ||
      !point.conclusion ||
      point.evidenceRefs.length === 0 ||
      point.decision !== "supports_investment"
    ) {
      missing.add(code);
    }
  }
  // 三个带原因的向缺失原因时只做待补、不关闭记录 —— 与市场信号阶段
  // "缺不采纳原因时保存但不关闭" 是同一条规则，不另发明一套。
  if (decision?.outcome === "defer" && !draft.validationFocus) {
    missing.add("validation_focus");
  }
  if (decision?.outcome === "defer" && !draft.reconsiderationDate) {
    missing.add("reconsideration_date");
  }
  if (decision?.outcome === "reject" && !decision.rejectReason) {
    missing.add("reject_reason");
  }
  if (decision?.outcome === "return_to_market" && !decision.returnReason) {
    missing.add("return_reason");
  }
  if (decision?.outcome === "return_to_market" && !decision.returnBasis) {
    missing.add("return_basis");
  }
  return PENDING_FIELD_ORDER.filter((code) => missing.has(code));
}

export function prepareProductInitiativeDecision(
  current: CurrentProductInitiative,
  actorId: string,
  command: ProductInitiativeDecisionCommandV1,
  gate: readonly ProductInitiativeReviewPointCodeV1[] = PRODUCT_INITIATIVE_GATE,
  todayUtc = new Date().toISOString().slice(0, 10),
  unitEconomicsContext: ProductInitiativeUnitEconomicsContext = {
    marketCode: null,
    channelCode: null,
    currencyResolution: null,
  },
): PreparedProductInitiativeDecision {
  if (command.contractVersion !== "product-initiative-decision.v1") {
    invalid("contractVersion");
  }
  const normalizedActorId = text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedVersion = version(command.expectedInitiativeVersion);
  if (expectedVersion !== current.version) {
    conflict("PRODUCT_INITIATIVE_VERSION_CONFLICT");
  }
  if (!OUTCOMES.has(command.outcome)) invalid("outcome");
  const initiativeId = uuid(command.requestId, "requestId");

  const draft = draftFromCommand(command);
  draft.businessCaseDraft = normalizeBusinessCase(
    command.businessCaseDraft ?? [],
  );
  const unitEconomics = prepareProductInitiativeUnitEconomics({
    draft: command.unitEconomicsDraft,
    negativeConservativeReason: command.negativeConservativeReason,
    context: unitEconomicsContext,
  });
  draft.unitEconomicsDraft = unitEconomics.draft;
  draft.unitEconomicsSnapshot = unitEconomics.snapshot;
  draft.negativeConservativeReason = unitEconomics.negativeConservativeReason;
  const outcome = command.outcome;
  const pendingFieldCodes = [
    ...productInitiativePendingFieldCodes(draft, {
      outcome,
      deferReason: draft.deferReason,
      rejectReason: draft.rejectReason,
      returnReason: draft.returnReason,
      returnBasis: draft.returnBasis ?? null,
    }),
    ...unitEconomics.pendingFieldCodes,
  ];

  if (outcome === "approve") {
    // 立项是硬门槛：门槛项没齐就明确失败，并说明还差哪几项。
    const blocking = pendingFieldCodes.filter(
      (code) =>
        isUnitEconomicsPendingFieldCode(code) || isApproveGateCode(code, gate),
    );
    if (blocking.length > 0) {
      throw new ProductInitiativeValidationError(
        `PRODUCT_INITIATIVE_INCOMPLETE: ${blocking.join(",")}`,
      );
    }
  }
  if (
    outcome !== "defer" &&
    draft.businessCaseDraft?.some(
      (point) => point.decision === "validate_before_investment",
    )
  ) {
    invalid("businessCaseDraft.decision");
  }
  if (
    outcome === "return_to_market" &&
    draft.businessCaseDraft?.some(
      (point) => point.decision === "does_not_support",
    )
  ) {
    invalid("businessCaseDraft.decision");
  }
  if (
    outcome === "defer" &&
    draft.reconsiderationDate &&
    draft.reconsiderationDate < todayUtc
  ) {
    throw new ProductInitiativeValidationError(
      "VALIDATION_FORMAT: reconsiderationDate",
    );
  }

  const reason = reasonFor(outcome, draft);
  const normalized = {
    expectedVersion,
    initiativeId,
    outcome,
    completion: completionFor(outcome, reason, draft.returnBasis ?? null),
    nextDestination: destinationFor(outcome, reason, draft.returnBasis ?? null),
    responsibleActorId: normalizedActorId,
    responsibilityAccepted:
      outcome === "approve" ? draft.responsibilityAccepted : null,
    receivingTeamOrRole:
      outcome === "approve" ? draft.receivingTeamOrRole : null,
    resourceDescription:
      outcome === "approve" ? draft.resourceDescription : null,
    targetDate: outcome === "approve" ? draft.targetDate : null,
    nextDecisionDate: outcome === "approve" ? draft.nextDecisionDate : null,
    nextDecisionQuestion:
      outcome === "approve" ? draft.nextDecisionQuestion : null,
    validationFocus: outcome === "defer" ? draft.validationFocus : null,
    reconsiderationDate: outcome === "defer" ? draft.reconsiderationDate : null,
    unitEconomicsDraft: draft.unitEconomicsDraft,
    unitEconomicsSnapshot: draft.unitEconomicsSnapshot,
    negativeConservativeReason: draft.negativeConservativeReason,
    objective: draft.objective,
    reviewPoints: draft.reviewPoints,
    businessCaseDraft: draft.businessCaseDraft ?? [],
    businessCaseSnapshot:
      outcome === "approve"
        ? ((draft.businessCaseDraft ?? []).map((point) => ({
            dimensionCode: point.dimensionCode,
            decision: "supports_investment" as const,
            conclusion: point.conclusion!,
            evidenceRefs: [...point.evidenceRefs],
            criticalUnknown: null,
          })) as NonNullable<ProductInitiativeV1["businessCaseSnapshot"]>)
        : null,
    reason,
    returnBasis:
      outcome === "return_to_market" ? (draft.returnBasis ?? null) : null,
    pendingFieldCodes,
    idempotencyKey,
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function assertProductInitiativeEvidenceRefs(
  decision: Pick<
    PreparedProductInitiativeDecision,
    "reviewPoints" | "unitEconomicsDraft"
  > &
    Partial<Pick<PreparedProductInitiativeDecision, "businessCaseDraft">>,
  availableEvidenceRefs: readonly string[],
): void {
  const available = new Set(availableEvidenceRefs);
  const unitEconomicsRefs = UNIT_ECONOMICS_SCENARIO_KEYS.flatMap((scenario) =>
    UNIT_ECONOMICS_AMOUNT_KEYS.flatMap(
      (amount) =>
        decision.unitEconomicsDraft?.scenarios?.[scenario]?.[amount]
          ?.evidenceRefs ?? [],
    ),
  );
  const invalid = [
    ...new Set([
      ...decision.reviewPoints.flatMap((point) => point.evidenceRefs),
      ...(decision.businessCaseDraft ?? []).flatMap(
        (point) => point.evidenceRefs,
      ),
      ...unitEconomicsRefs,
    ]),
  ]
    .filter((evidenceRef) => !available.has(evidenceRef))
    .sort();
  if (invalid.length > 0) {
    throw new ProductInitiativeValidationError(
      `PRODUCT_INITIATIVE_EVIDENCE_INVALID: ${invalid.join(",")}`,
    );
  }
}

function draftFromCommand(
  command: ProductInitiativeDecisionCommandV1,
): ProductInitiativeDraft {
  const raw = command.reviewPoints ?? [];
  if (!Array.isArray(raw) || raw.length > REVIEW_POINT_ORDER.length) {
    invalid("reviewPoints");
  }
  const seen = new Set<ProductInitiativeReviewPointCodeV1>();
  const reviewPoints = raw.map((point) => {
    if (!REVIEW_POINT_CODES.has(point.code)) invalid("reviewPoints.code");
    if (seen.has(point.code)) invalid("reviewPoints.code");
    seen.add(point.code);
    return {
      code: point.code,
      evidenceRefs: uniqueUuids(point.evidenceRefs ?? [], "evidenceRefs"),
      conclusion: optionalText(point.conclusion, "conclusion", 4000),
    };
  });
  return {
    objective: optionalText(command.objective, "objective", 4000),
    reviewPoints: REVIEW_POINT_ORDER.flatMap((code) =>
      reviewPoints.filter((point) => point.code === code),
    ),
    businessCaseDraft: [],
    deferReason: optionalText(command.deferReason, "deferReason", 500),
    rejectReason: optionalText(command.rejectReason, "rejectReason", 500),
    returnReason: optionalText(command.returnReason, "returnReason", 500),
    returnBasis: returnBasis(command.returnBasis),
    responsibilityAccepted: command.acceptResponsibility === true,
    receivingTeamOrRole: optionalText(
      command.receivingTeamOrRole,
      "receivingTeamOrRole",
      200,
    ),
    resourceDescription: optionalText(
      command.resourceDescription,
      "resourceDescription",
      2000,
    ),
    targetDate: optionalDate(command.targetDate, "targetDate"),
    nextDecisionDate: optionalDate(
      command.nextDecisionDate,
      "nextDecisionDate",
    ),
    nextDecisionQuestion: optionalText(
      command.nextDecisionQuestion,
      "nextDecisionQuestion",
      1000,
    ),
    validationFocus: optionalText(
      command.validationFocus,
      "validationFocus",
      2000,
    ),
    reconsiderationDate: optionalDate(
      command.reconsiderationDate,
      "reconsiderationDate",
    ),
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
  };
}

function isUnitEconomicsPendingFieldCode(
  code: ProductInitiativePendingFieldCodeV1,
): boolean {
  return (
    code === "negativeConservativeReason" || code.startsWith("unitEconomics.")
  );
}

function isApproveGateCode(
  code: ProductInitiativePendingFieldCodeV1,
  _gate: readonly ProductInitiativeReviewPointCodeV1[],
): boolean {
  void _gate;
  return (
    (BUSINESS_CASE_DIMENSIONS as readonly string[]).includes(code) ||
    APPROVE_REQUIRED_CODES.has(code)
  );
}

export const BUSINESS_CASE_DIMENSIONS: readonly ProductInitiativeBusinessCaseDimensionCodeV1[] =
  [
    "customer_need",
    "value_differentiation",
    "commercial_viability",
    "supply_technical_feasibility",
    "strategy_portfolio",
  ];

function normalizeBusinessCase(
  raw: ProductInitiativeBusinessCaseDimensionDraftV1[],
): ProductInitiativeBusinessCaseDimensionDraftV1[] {
  if (!Array.isArray(raw) || raw.length > BUSINESS_CASE_DIMENSIONS.length)
    invalid("businessCaseDraft");
  const seen = new Set<string>();
  const points = raw.map((point) => {
    if (
      !point ||
      !BUSINESS_CASE_DIMENSIONS.includes(point.dimensionCode) ||
      seen.has(point.dimensionCode)
    )
      invalid("businessCaseDraft.dimensionCode");
    seen.add(point.dimensionCode);
    if (
      point.decision &&
      ![
        "supports_investment",
        "validate_before_investment",
        "does_not_support",
      ].includes(point.decision)
    )
      invalid("businessCaseDraft.decision");
    const criticalUnknown = optionalText(
      point.criticalUnknown,
      "businessCaseDraft.criticalUnknown",
      2000,
    );
    if (
      point.decision === "validate_before_investment"
        ? !criticalUnknown
        : !!criticalUnknown
    )
      invalid("businessCaseDraft.criticalUnknown");
    return {
      dimensionCode: point.dimensionCode,
      ...(point.decision ? { decision: point.decision } : {}),
      conclusion: optionalText(
        point.conclusion,
        "businessCaseDraft.conclusion",
        4000,
      ),
      evidenceRefs: uniqueUuids(
        point.evidenceRefs ?? [],
        "businessCaseDraft.evidenceRefs",
      ),
      criticalUnknown,
    };
  });
  return BUSINESS_CASE_DIMENSIONS.flatMap((code) =>
    points.filter((point) => point.dimensionCode === code),
  );
}

function reasonFor(
  outcome: ProductInitiativeOutcomeV1,
  draft: ProductInitiativeDraft,
): string | null {
  if (outcome === "defer") {
    return draft.validationFocus && draft.reconsiderationDate
      ? draft.validationFocus
      : null;
  }
  if (outcome === "reject") return draft.rejectReason;
  if (outcome === "return_to_market") return draft.returnReason;
  return null;
}

function completionFor(
  outcome: ProductInitiativeOutcomeV1,
  reason: string | null,
  returnBasis: ProductInitiativeReturnBasisV1 | null,
): ProductInitiativeCompletionV1 {
  if (outcome === "approve") return "completed";
  if (outcome === "return_to_market") {
    return reason && returnBasis ? "completed" : "pending_completion";
  }
  return reason ? "completed" : "pending_completion";
}

function destinationFor(
  outcome: ProductInitiativeOutcomeV1,
  reason: string | null,
  returnBasis: ProductInitiativeReturnBasisV1 | null,
): ProductInitiativeDestinationV1 {
  if (
    outcome !== "approve" &&
    (!reason || (outcome === "return_to_market" && !returnBasis))
  ) {
    return "needs_decision";
  }
  if (outcome === "approve") return "handed_off";
  if (outcome === "defer") return "deferred";
  if (outcome === "reject") return "rejected";
  return "return_requested";
}

function returnBasis(
  value: ProductInitiativeReturnBasisV1 | undefined,
): ProductInitiativeReturnBasisV1 | null {
  if (value === undefined) return null;
  if (value !== "insufficient_evidence" && value !== "wrong_direction") {
    invalid("returnBasis");
  }
  return value;
}

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function optionalText(
  value: string | undefined | null,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field, maxLength);
}

function optionalDate(
  value: string | undefined | null,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) invalid(field);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    invalid(field);
  }
  return value;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalid("expectedInitiativeVersion");
  }
  return value;
}

function uuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) invalid(field);
  return value.toLowerCase();
}

function uniqueUuids(values: string[], field: string): string[] {
  if (!Array.isArray(values) || values.length > 100) invalid(field);
  const normalized = values.map((value) => uuid(value, field));
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) invalid(field);
  return unique;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function invalid(field: string): never {
  throw new ProductInitiativeValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new ProductInitiativeConflictError(code);
}

const REVIEW_POINT_ORDER: ProductInitiativeReviewPointCodeV1[] = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
  // 专业要求「售后原声」的证据落到这一条 —— 没有它，证据收了却没有地方形成结论。
  "customer_feedback",
];
const REVIEW_POINT_CODES = new Set<string>(REVIEW_POINT_ORDER);
const PENDING_FIELD_ORDER: ProductInitiativePendingFieldCodeV1[] = [
  "objective",
  ...BUSINESS_CASE_DIMENSIONS,
  "defer_reason",
  "responsibility_commitment",
  "receiving_team_or_role",
  "resource_description",
  "target_date",
  "next_decision_date",
  "next_decision_question",
  "validation_focus",
  "reconsideration_date",
  "reject_reason",
  "return_basis",
  "return_reason",
];
const APPROVE_REQUIRED_CODES = new Set<ProductInitiativePendingFieldCodeV1>([
  "objective",
  "responsibility_commitment",
  "receiving_team_or_role",
  "resource_description",
  "target_date",
  "next_decision_date",
  "next_decision_question",
]);
const UNIT_ECONOMICS_SCENARIO_KEYS = ["baseline", "conservative"] as const;
const UNIT_ECONOMICS_AMOUNT_KEYS = [
  "salePrice",
  "landedCost",
  "platformFee",
  "fulfillmentFee",
  "advertisingCost",
  "returnCost",
] as const;
const OUTCOMES = new Set<string>([
  "approve",
  "defer",
  "reject",
  "return_to_market",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
