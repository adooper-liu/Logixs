import { createHash } from "node:crypto";
import type {
  ProductInitiativeCompletionV1,
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeDestinationV1,
  ProductInitiativeOutcomeV1,
  ProductInitiativePendingFieldCodeV1,
  ProductInitiativeReviewPointCodeV1,
} from "@logix/contracts";

export interface ProductInitiativeReviewPoint {
  code: ProductInitiativeReviewPointCodeV1;
  /** 引用已登记证据的 id；事实不在本聚合里另存一份。 */
  evidenceRefs: string[];
  conclusion: string | null;
}

export interface ProductInitiativeDraft {
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  deferReason: string | null;
  rejectReason: string | null;
  returnReason: string | null;
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
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  reason: string | null;
  pendingFieldCodes: ProductInitiativePendingFieldCodeV1[];
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductInitiativeValidationError extends Error {}
export class ProductInitiativeConflictError extends Error {}
export class ProductInitiativeNotFoundError extends Error {}

/**
 * 立项门槛：这几项缺失时**不能**立项（其余只作为待补）。
 *
 * 这是"严门槛"的单一可调处：若第一半验收发现队列积压，把某项从这里移出即可
 * 降级为待补，不需要改页面、接口或校验以外的任何地方。
 */
export const PRODUCT_INITIATIVE_GATE: readonly ProductInitiativeReviewPointCodeV1[] =
  [
    "target_user_and_market",
    "competitive_supply",
    "price_band_and_margin",
    "compliance_risk",
  ];
// 注意 `customer_feedback` **不在这张门槛表里**：它由「售后原声」这类专业要求喂证据，
// 收了没地方下结论才是问题；但把它加成第 5 项门槛，会让**存量记录追溯性变成不合格**。
// 门槛是政策，改它要连存量一起算，不能顺手加。

export function productInitiativePendingFieldCodes(
  draft: ProductInitiativeDraft,
  decision?: {
    outcome: ProductInitiativeOutcomeV1;
    deferReason: string | null;
    rejectReason: string | null;
    returnReason: string | null;
  },
): ProductInitiativePendingFieldCodeV1[] {
  const missing = new Set<ProductInitiativePendingFieldCodeV1>();
  if (!draft.objective) missing.add("objective");
  for (const code of REVIEW_POINT_ORDER) {
    const point = draft.reviewPoints.find((item) => item.code === code);
    // 有结论没证据、或有证据没结论，都还不算这条要点成立。
    if (!point || point.evidenceRefs.length === 0 || !point.conclusion) {
      missing.add(code);
    }
  }
  // 三个带原因的向缺失原因时只做待补、不关闭记录 —— 与市场信号阶段
  // "缺不采纳原因时保存但不关闭" 是同一条规则，不另发明一套。
  if (decision?.outcome === "defer" && !decision.deferReason) {
    missing.add("defer_reason");
  }
  if (decision?.outcome === "reject" && !decision.rejectReason) {
    missing.add("reject_reason");
  }
  if (decision?.outcome === "return_to_market" && !decision.returnReason) {
    missing.add("return_reason");
  }
  return PENDING_FIELD_ORDER.filter((code) => missing.has(code));
}

export function prepareProductInitiativeDecision(
  current: CurrentProductInitiative,
  actorId: string,
  command: ProductInitiativeDecisionCommandV1,
  gate: readonly ProductInitiativeReviewPointCodeV1[] = PRODUCT_INITIATIVE_GATE,
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
  const outcome = command.outcome;
  const pendingFieldCodes = productInitiativePendingFieldCodes(draft, {
    outcome,
    deferReason: draft.deferReason,
    rejectReason: draft.rejectReason,
    returnReason: draft.returnReason,
  });

  if (outcome === "approve") {
    // 立项是硬门槛：门槛项没齐就明确失败，并说明还差哪几项。
    const blocking = pendingFieldCodes.filter((code) => isGateCode(code, gate));
    if (blocking.length > 0) {
      throw new ProductInitiativeValidationError(
        `PRODUCT_INITIATIVE_INCOMPLETE: ${blocking.join(",")}`,
      );
    }
  }

  const reason = reasonFor(outcome, draft);
  const normalized = {
    expectedVersion,
    initiativeId,
    outcome,
    completion: completionFor(outcome, reason),
    nextDestination: destinationFor(outcome, reason),
    responsibleActorId: normalizedActorId,
    objective: draft.objective,
    reviewPoints: draft.reviewPoints,
    reason,
    pendingFieldCodes,
    idempotencyKey,
  };
  return { ...normalized, payloadHash: hash(normalized) };
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
    deferReason: optionalText(command.deferReason, "deferReason", 500),
    rejectReason: optionalText(command.rejectReason, "rejectReason", 500),
    returnReason: optionalText(command.returnReason, "returnReason", 500),
  };
}

function isGateCode(
  code: ProductInitiativePendingFieldCodeV1,
  gate: readonly ProductInitiativeReviewPointCodeV1[],
): boolean {
  return (REVIEW_POINT_ORDER as readonly string[]).includes(code)
    ? gate.includes(code as ProductInitiativeReviewPointCodeV1)
    : code === "objective";
}

function reasonFor(
  outcome: ProductInitiativeOutcomeV1,
  draft: ProductInitiativeDraft,
): string | null {
  if (outcome === "defer") return draft.deferReason;
  if (outcome === "reject") return draft.rejectReason;
  if (outcome === "return_to_market") return draft.returnReason;
  return null;
}

function completionFor(
  outcome: ProductInitiativeOutcomeV1,
  reason: string | null,
): ProductInitiativeCompletionV1 {
  if (outcome === "approve") return "completed";
  return reason ? "completed" : "pending_completion";
}

function destinationFor(
  outcome: ProductInitiativeOutcomeV1,
  reason: string | null,
): ProductInitiativeDestinationV1 {
  if (!reason && outcome !== "approve") return "needs_decision";
  if (outcome === "approve") return "handed_off";
  if (outcome === "defer") return "deferred";
  if (outcome === "reject") return "rejected";
  return "returned_to_market";
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
  ...REVIEW_POINT_ORDER,
  "defer_reason",
  "reject_reason",
  "return_reason",
];
const OUTCOMES = new Set<string>([
  "approve",
  "defer",
  "reject",
  "return_to_market",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
