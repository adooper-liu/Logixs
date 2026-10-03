import { createHash } from "node:crypto";
import type {
  MarketSignalCreateCommandV1,
  MarketSignalDecisionCommandV1,
  MarketSignalDecisionCompletionV1,
  MarketSignalDecisionTypeV1,
  MarketSignalDestinationV1,
  MarketSignalPendingFieldCodeV1,
  MarketSignalUpdateCommandV1,
} from "@logix/contracts";

export interface MarketSignalFacts {
  title: string;
  marketCode: string | null;
  channelCode: string | null;
  categoryRef: string | null;
  observedFactSummary: string | null;
  hypothesis: string | null;
  evidenceRefs: string[];
}

export interface NormalizedMarketSignalCreate extends MarketSignalFacts {
  signalId: string;
  ownerTeamCode: string;
  idempotencyKey: string;
  payloadHash: string;
}

export interface NormalizedMarketSignalUpdate {
  expectedSignalVersion: number;
  changes: Partial<
    Pick<
      MarketSignalFacts,
      | "marketCode"
      | "channelCode"
      | "categoryRef"
      | "observedFactSummary"
      | "hypothesis"
    >
  >;
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedMarketSignalDecision {
  expectedSignalVersion: number;
  decisionType: MarketSignalDecisionTypeV1;
  completion: MarketSignalDecisionCompletionV1;
  nextDestination: MarketSignalDestinationV1;
  judgmentNote: string | null;
  opportunityStatement: string | null;
  nextReviewDate: string | null;
  watchFocus: string | null;
  waitingReason: string | null;
  dismissReason: string | null;
  pendingFieldCodes: MarketSignalPendingFieldCodeV1[];
  idempotencyKey: string;
  payloadHash: string;
}

export class MarketSignalValidationError extends Error {}
export class MarketSignalConflictError extends Error {}
export class MarketSignalNotFoundError extends Error {}

export function normalizeMarketSignalCreate(
  command: MarketSignalCreateCommandV1,
): NormalizedMarketSignalCreate {
  if (command.contractVersion !== "market-signal-create.v1") {
    fail("contractVersion");
  }
  const signalId = uuid(command.requestId, "requestId");
  const evidenceRefs = uniqueUuids(command.evidenceRefs ?? [], "evidenceRefs");
  const normalized = {
    signalId,
    title: text(command.title, "title", 300),
    marketCode: optionalText(command.marketCode, "marketCode", 100),
    channelCode: optionalText(command.channelCode, "channelCode", 100),
    categoryRef: optionalText(command.categoryRef, "categoryRef", 200),
    observedFactSummary: optionalText(
      command.observedFactSummary,
      "observedFactSummary",
      4000,
    ),
    hypothesis: optionalText(command.hypothesis, "hypothesis", 4000),
    evidenceRefs,
    ownerTeamCode:
      optionalText(command.ownerTeamCode, "ownerTeamCode", 100) ??
      "market_intelligence",
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function normalizeMarketSignalUpdate(
  command: MarketSignalUpdateCommandV1,
): NormalizedMarketSignalUpdate {
  if (command.contractVersion !== "market-signal-update.v1") {
    fail("contractVersion");
  }
  const changes: NormalizedMarketSignalUpdate["changes"] = {};
  if (command.marketCode !== undefined) {
    changes.marketCode = text(command.marketCode, "marketCode", 100);
  }
  if (command.channelCode !== undefined) {
    changes.channelCode = text(command.channelCode, "channelCode", 100);
  }
  if (command.categoryRef !== undefined) {
    changes.categoryRef = text(command.categoryRef, "categoryRef", 200);
  }
  if (command.observedFactSummary !== undefined) {
    changes.observedFactSummary = text(
      command.observedFactSummary,
      "observedFactSummary",
      4000,
    );
  }
  if (command.hypothesis !== undefined) {
    changes.hypothesis = text(command.hypothesis, "hypothesis", 4000);
  }
  if (Object.keys(changes).length === 0) fail("changes");
  const normalized = {
    expectedSignalVersion: version(
      command.expectedSignalVersion,
      "expectedSignalVersion",
    ),
    changes,
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function prepareMarketSignalDecision(
  facts: MarketSignalFacts,
  command: MarketSignalDecisionCommandV1,
): PreparedMarketSignalDecision {
  if (command.contractVersion !== "market-signal-decision.v1") {
    fail("contractVersion");
  }
  if (!DECISIONS.has(command.decisionType)) fail("decisionType");
  const isClose =
    command.decisionType === "void" || command.decisionType === "archive";
  const judgmentNote = isClose
    ? optionalText(command.judgmentNote, "judgmentNote", 500)
    : optionalText(command.judgmentNote, "judgmentNote", 4000);
  const opportunityStatement = optionalText(
    command.opportunityStatement,
    "opportunityStatement",
    4000,
  );
  const nextReviewDate = optionalDate(command.nextReviewDate);
  const watchFocus = optionalText(command.watchFocus, "watchFocus", 4000);
  const waitingReason = optionalText(
    command.waitingReason,
    "waitingReason",
    500,
  );
  const dismissReason = optionalText(
    command.dismissReason,
    "dismissReason",
    500,
  );
  const completion = decisionCompletion(
    command.decisionType,
    nextReviewDate,
    watchFocus,
    dismissReason,
    judgmentNote,
  );
  const normalized = {
    expectedSignalVersion: version(
      command.expectedSignalVersion,
      "expectedSignalVersion",
    ),
    decisionType: command.decisionType,
    completion,
    nextDestination: destination(command.decisionType, completion),
    judgmentNote,
    opportunityStatement:
      command.decisionType === "handoff" ? opportunityStatement : null,
    nextReviewDate: command.decisionType === "watch" ? nextReviewDate : null,
    watchFocus: command.decisionType === "watch" ? watchFocus : null,
    waitingReason: command.decisionType === "watch" ? waitingReason : null,
    dismissReason: command.decisionType === "dismiss" ? dismissReason : null,
    pendingFieldCodes: pendingFieldCodes(facts, {
      decisionType: command.decisionType,
      opportunityStatement,
      nextReviewDate,
      watchFocus,
      dismissReason,
      judgmentNote,
    }),
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  const payloadHash = hash({
    expectedSignalVersion: normalized.expectedSignalVersion,
    decisionType: normalized.decisionType,
    judgmentNote: normalized.judgmentNote,
    opportunityStatement: normalized.opportunityStatement,
    nextReviewDate: normalized.nextReviewDate,
    watchFocus: normalized.watchFocus,
    waitingReason: normalized.waitingReason,
    dismissReason: normalized.dismissReason,
    idempotencyKey: normalized.idempotencyKey,
  });
  return { ...normalized, payloadHash };
}

/** 选品退回：由 Port 写入，不经经营岗判断命令。理由落在 judgment_note。 */
export function prepareSelectionReturnDecision(input: {
  expectedSignalVersion: number;
  returnReason: string;
  idempotencyKey: string;
}): PreparedMarketSignalDecision {
  const judgmentNote = text(input.returnReason, "returnReason", 500);
  const normalized = {
    expectedSignalVersion: version(
      input.expectedSignalVersion,
      "expectedSignalVersion",
    ),
    decisionType: "selection_return" as const,
    completion: "completed" as const,
    nextDestination: "returned_from_selection" as const,
    judgmentNote,
    opportunityStatement: null,
    nextReviewDate: null,
    watchFocus: null,
    waitingReason: null,
    dismissReason: null,
    pendingFieldCodes: [] as MarketSignalPendingFieldCodeV1[],
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function pendingFieldCodes(
  facts: MarketSignalFacts,
  decision?: {
    decisionType: MarketSignalDecisionCommandV1["decisionType"];
    opportunityStatement: string | null;
    nextReviewDate: string | null;
    watchFocus: string | null;
    dismissReason: string | null;
    judgmentNote?: string | null;
  },
): MarketSignalPendingFieldCodeV1[] {
  const missing = new Set<MarketSignalPendingFieldCodeV1>();
  if (!facts.marketCode) missing.add("market_code");
  if (!facts.channelCode) missing.add("channel_code");
  if (!facts.categoryRef) missing.add("category_ref");
  if (!facts.observedFactSummary) missing.add("observed_fact_summary");
  if (!facts.hypothesis) missing.add("hypothesis");
  if (facts.evidenceRefs.length === 0) missing.add("evidence_refs");
  if (decision?.decisionType === "handoff" && !decision.opportunityStatement) {
    missing.add("opportunity_statement");
  }
  if (decision?.decisionType === "watch" && !decision.nextReviewDate) {
    missing.add("next_review_date");
  }
  if (decision?.decisionType === "watch" && !decision.watchFocus) {
    missing.add("watch_focus");
  }
  if (decision?.decisionType === "dismiss" && !decision.dismissReason) {
    missing.add("dismiss_reason");
  }
  if (
    (decision?.decisionType === "void" ||
      decision?.decisionType === "archive") &&
    !decision.judgmentNote
  ) {
    missing.add("close_reason");
  }
  return PENDING_FIELD_ORDER.filter((code) => missing.has(code));
}

function decisionCompletion(
  decision: MarketSignalDecisionCommandV1["decisionType"],
  nextReviewDate: string | null,
  watchFocus: string | null,
  dismissReason: string | null,
  closeReason: string | null,
): MarketSignalDecisionCompletionV1 {
  if (decision === "watch") {
    return nextReviewDate && watchFocus ? "completed" : "pending_completion";
  }
  if (decision === "dismiss") {
    return dismissReason ? "completed" : "pending_completion";
  }
  if (decision === "void" || decision === "archive") {
    return closeReason ? "completed" : "pending_completion";
  }
  return "completed";
}

function destination(
  decision: MarketSignalDecisionCommandV1["decisionType"],
  completion: MarketSignalDecisionCompletionV1,
): MarketSignalDestinationV1 {
  if (completion === "pending_completion") return "needs_decision";
  if (decision === "watch") return "watching";
  if (decision === "dismiss") return "dismissed";
  if (decision === "handoff") return "handed_off";
  if (decision === "void") return "voided";
  if (decision === "archive") return "archived";
  return "handed_off";
}

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") fail(field);
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    containsControlCharacter(normalized)
  ) {
    fail(field);
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  field: string,
  maxLength: number,
): string | null {
  return value === undefined ? null : text(value, field, maxLength);
}

function optionalDate(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!DATE_PATTERN.test(value)) fail("nextReviewDate");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    fail("nextReviewDate");
  }
  return value;
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) fail(field);
  return value;
}

function uuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function uniqueUuids(values: string[], field: string): string[] {
  if (!Array.isArray(values) || values.length > 100) fail(field);
  const normalized = values.map((value) => uuid(value, field));
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) fail(field);
  return unique;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function fail(field: string): never {
  throw new MarketSignalValidationError(`VALIDATION_FORMAT: ${field}`);
}

const DECISIONS = new Set(["watch", "handoff", "dismiss", "void", "archive"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_FIELD_ORDER: MarketSignalPendingFieldCodeV1[] = [
  "market_code",
  "channel_code",
  "category_ref",
  "observed_fact_summary",
  "hypothesis",
  "evidence_refs",
  "opportunity_statement",
  "next_review_date",
  "watch_focus",
  "dismiss_reason",
  "close_reason",
];
