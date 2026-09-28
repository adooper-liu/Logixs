import { createHash } from "node:crypto";
import type {
  ShipmentWorkHandoffClaimCommandV1,
  ShipmentWorkHandoffCloseCommandV1,
  ShipmentWorkHandoffRaiseCommandV1,
  ShipmentWorkHandoffStateV1,
  WorkHandoffRecipientV1,
} from "@logix/contracts";

/**
 * 事项交接：出运运营把票级事项交给专业岗位队列，该岗位领取、了结。
 *
 * 三条贯穿的规矩：
 *
 * 1. **只到岗位不到人。** 交出去的人只需判断交给哪个岗位，不必知道今天谁在班 ——
 *    这是"拉"而不是"指派"，跨岗位协作行业里都这么做。
 * 2. **`state` 只说"有没有人接、了没了的"**，不是 Shipment 的生命周期状态
 *    （基线：交接带表达真实业务接力，不新增领域状态）。
 * 3. **了结必须给结论。** 交出去的人靠这句话判断这一票能不能往下走；
 *    不写等于把人晾在半路。
 */

export const WORK_HANDOFF_RECIPIENTS: readonly WorkHandoffRecipientV1[] = [
  "customs",
  "pickup",
  "delivery",
  "unloading",
];

export interface CurrentWorkHandoff {
  state: ShipmentWorkHandoffStateV1;
  version: number;
  claimedByActorId: string | null;
}

export interface PreparedWorkHandoffRaise {
  recipientQueueCode: WorkHandoffRecipientV1;
  title: string;
  detail: string | null;
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedWorkHandoffClaim {
  expectedVersion: number;
  version: number;
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedWorkHandoffClose {
  expectedVersion: number;
  version: number;
  conclusion: string;
  idempotencyKey: string;
  payloadHash: string;
}

export class WorkHandoffValidationError extends Error {}
export class WorkHandoffConflictError extends Error {}

export function prepareWorkHandoffRaise(
  actorId: string,
  command: ShipmentWorkHandoffRaiseCommandV1,
): PreparedWorkHandoffRaise {
  if (command.contractVersion !== "shipment-work-handoff-raise.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  if (!WORK_HANDOFF_RECIPIENTS.includes(command.recipientQueueCode)) {
    invalid("recipientQueueCode");
  }
  const normalized = {
    recipientQueueCode: command.recipientQueueCode,
    title: text(command.title, "title", 200),
    detail: optionalText(command.detail, "detail", 4000),
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function prepareWorkHandoffClaim(
  current: CurrentWorkHandoff,
  actorId: string,
  command: ShipmentWorkHandoffClaimCommandV1,
): PreparedWorkHandoffClaim {
  if (command.contractVersion !== "shipment-work-handoff-claim.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  // **先判归属再判版本**：典型现场是"读到时还没人接，点下去已经被接了"，
  // 这时版本必然也过期 —— 先判版本会把"被领走了"报成"版本冲突"，让人以为点错了地方。
  if (current.state !== "raised") {
    conflict("SHIPMENT_WORK_HANDOFF_ALREADY_CLAIMED");
  }
  const expectedVersion = requireVersion(current, command.expectedVersion);
  const normalized = {
    expectedVersion,
    version: current.version + 1,
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function prepareWorkHandoffClose(
  current: CurrentWorkHandoff,
  actorId: string,
  command: ShipmentWorkHandoffCloseCommandV1,
): PreparedWorkHandoffClose {
  if (command.contractVersion !== "shipment-work-handoff-close.v1") {
    invalid("contractVersion");
  }
  const normalizedActorId = text(actorId, "actorId", 200);
  // 同上：归属与状态先判，版本最后 —— 报出来的原因才对人有指导意义。
  if (current.state === "closed") {
    conflict("SHIPMENT_WORK_HANDOFF_ALREADY_CLOSED");
  }
  if (current.state !== "claimed") {
    // 没领就了结，等于替别人把活记成做完了。
    conflict("SHIPMENT_WORK_HANDOFF_NOT_CLAIMED");
  }
  if (current.claimedByActorId !== normalizedActorId) {
    // 领了才是你的活；别人不能替你结。
    conflict("SHIPMENT_WORK_HANDOFF_NOT_YOURS");
  }
  const expectedVersion = requireVersion(current, command.expectedVersion);
  const normalized = {
    expectedVersion,
    version: current.version + 1,
    conclusion: text(command.conclusion, "conclusion", 1000),
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

function requireVersion(current: CurrentWorkHandoff, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid("expectedVersion");
  if (value !== current.version)
    conflict("SHIPMENT_WORK_HANDOFF_VERSION_CONFLICT");
  return value;
}

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, field, maxLength);
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function invalid(field: string): never {
  throw new WorkHandoffValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new WorkHandoffConflictError(code);
}
