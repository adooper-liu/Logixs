import { createHash } from "node:crypto";
import { FIRST_SLICE_CLIENT_ACTION } from "./client-operation";

export const FIRST_SLICE_COMPENSATION_ACTION =
  "lifecycle.compensate_apply_event";

export type CompensationState =
  | "not_required"
  | "pending"
  | "in_progress"
  | "compensated"
  | "failed"
  | "manual_review";

export interface CompensationRecord {
  id: string;
  tenantId: string;
  originalClientOperationId: string;
  compensationActionCode: string;
  state: CompensationState;
  reasonCode: string;
  requestedBy: string;
  resultRefs: Array<{ entityType: string; entityId: string }>;
  idempotencyKey: string;
  requestHash: string;
  traceId: string;
  createdAt: Date;
  updatedAt: Date;
}

const COMPENSATION_ACTION_BY_ORIGINAL: Readonly<Record<string, string>> = {
  [FIRST_SLICE_CLIENT_ACTION]: FIRST_SLICE_COMPENSATION_ACTION,
};

export function compensationActionFor(actionCode: string): string | null {
  return COMPENSATION_ACTION_BY_ORIGINAL[actionCode] ?? null;
}

export function hashCompensationRequest(input: {
  reasonCode: string;
  compensationActionCode: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        compensationActionCode: input.compensationActionCode,
        reasonCode: input.reasonCode,
      }),
      "utf8",
    )
    .digest("hex");
}

export function decideRequestCompensation(input: {
  tenantId: string;
  commandTenantId: string;
  commitState: string;
  actionCode: string;
}):
  | { kind: "ok"; actionCode: string }
  | { kind: "reject"; code: string; message: string } {
  if (input.tenantId !== input.commandTenantId) {
    return {
      kind: "reject",
      code: "AUTHORIZATION_SCOPE_DENIED",
      message: "租户不匹配",
    };
  }
  if (input.commitState !== "committed") {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "只有已落账操作可以登记补偿",
    };
  }
  const actionCode = compensationActionFor(input.actionCode);
  if (!actionCode) {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "动作未提供补偿语义",
    };
  }
  return { kind: "ok", actionCode };
}

export function assertCompensationCommand(input: {
  reasonCode: string;
  idempotencyKey: string;
  requestedBy: string;
}): { reasonCode: string; idempotencyKey: string; requestedBy: string } {
  const reasonCode = input.reasonCode.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const requestedBy = input.requestedBy.trim();
  if (reasonCode.length === 0 || reasonCode.length > 64) {
    throw new Error("VALIDATION_FORMAT: reasonCode 无效");
  }
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    throw new Error("VALIDATION_FORMAT: idempotencyKey 无效");
  }
  if (requestedBy.length === 0 || requestedBy.length > 128) {
    throw new Error("VALIDATION_FORMAT: requestedBy 无效");
  }
  return { reasonCode, idempotencyKey, requestedBy };
}

export function buildPendingCompensation(input: {
  id: string;
  tenantId: string;
  originalClientOperationId: string;
  compensationActionCode: string;
  reasonCode: string;
  requestedBy: string;
  idempotencyKey: string;
  requestHash: string;
  traceId: string;
  now: Date;
}): CompensationRecord {
  if (input.id === input.originalClientOperationId) {
    throw new Error("VALIDATION_FORMAT: 补偿不得复用原 clientOperationId");
  }
  const traceId = input.traceId.trim();
  if (traceId.length === 0 || traceId.length > 128) {
    throw new Error("VALIDATION_FORMAT: traceId 无效");
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    originalClientOperationId: input.originalClientOperationId,
    compensationActionCode: input.compensationActionCode,
    state: "pending",
    reasonCode: input.reasonCode,
    requestedBy: input.requestedBy,
    resultRefs: [],
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    traceId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

const RESOLVE_STATES = [
  "in_progress",
  "compensated",
  "failed",
  "manual_review",
] as const;

const ALLOWED_COMPENSATION_TRANSITIONS: Readonly<
  Record<CompensationState, readonly CompensationState[]>
> = {
  not_required: [],
  pending: ["in_progress", "compensated", "failed", "manual_review"],
  in_progress: ["compensated", "failed", "manual_review"],
  failed: ["manual_review"],
  compensated: [],
  manual_review: [],
};

export function parseCompensationResolveState(raw: string): CompensationState {
  const state = raw.trim();
  if (!RESOLVE_STATES.includes(state as (typeof RESOLVE_STATES)[number])) {
    throw new Error("VALIDATION_FORMAT: 补偿目标状态不受理");
  }
  return state as CompensationState;
}

export function parseCompensationResultRefs(
  raw: unknown,
): Array<{ entityType: string; entityId: string }> | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("VALIDATION_FORMAT: resultRefs 必须是数组");
  }
  return raw.map((item) => {
    if (
      item === null ||
      typeof item !== "object" ||
      typeof (item as { entityType?: unknown }).entityType !== "string" ||
      typeof (item as { entityId?: unknown }).entityId !== "string"
    ) {
      throw new Error("VALIDATION_FORMAT: resultRefs 项无效");
    }
    const entityType = (item as { entityType: string }).entityType.trim();
    const entityId = (item as { entityId: string }).entityId.trim();
    if (!entityType || !entityId) {
      throw new Error("VALIDATION_FORMAT: resultRefs 项无效");
    }
    return { entityType, entityId };
  });
}

export function decideResolveCompensation(input: {
  tenantId: string;
  commandTenantId: string;
  originalClientOperationId: string;
  pathOperationId: string;
  current: CompensationState;
  next: CompensationState;
}):
  | { kind: "ok" }
  | { kind: "replay" }
  | { kind: "reject"; code: string; message: string } {
  if (input.tenantId !== input.commandTenantId) {
    return {
      kind: "reject",
      code: "AUTHORIZATION_SCOPE_DENIED",
      message: "租户不匹配",
    };
  }
  if (input.originalClientOperationId !== input.pathOperationId) {
    return {
      kind: "reject",
      code: "RESOURCE_NOT_FOUND",
      message: "补偿不属于该操作",
    };
  }
  if (input.current === input.next) {
    return { kind: "replay" };
  }
  if (!ALLOWED_COMPENSATION_TRANSITIONS[input.current].includes(input.next)) {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "补偿状态转换不合法",
    };
  }
  return { kind: "ok" };
}

export function applyCompensationResolve(input: {
  record: CompensationRecord;
  next: CompensationState;
  resultRefs?: Array<{ entityType: string; entityId: string }>;
  now: Date;
}): CompensationRecord {
  return {
    ...input.record,
    state: input.next,
    resultRefs: input.resultRefs ?? input.record.resultRefs,
    updatedAt: input.now,
  };
}
