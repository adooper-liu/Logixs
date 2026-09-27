import { createHash } from "node:crypto";
import type { ProductInitiativeClaimCommandV1 } from "@logix/contracts";

/**
 * NPI 领取：把选品交过来的立项接到某个产品负责人名下。
 *
 * 这一片只做"接住"，不做"做完" —— 领取**不**等于立项成立，也**不**产生任何产品结论。
 * 立项阶段的结论在不可变快照里只读，本岗位不得改写（前一片明写的红线）。
 *
 * 与选品领取（`product-opportunity-intake`）同一形状：期望版本乐观锁 + 幂等键。
 * 页面停在旧版本上再点领取必须明确失败，让调用方重新加载，而不是覆盖别人的领取。
 */

/** 该立项当前的领取状态。`claimVersion` 为 0 表示还没有人接。 */
export interface CurrentProductInitiativeClaim {
  claimVersion: number;
  productOwnerActorId: string | null;
}

export interface PreparedProductInitiativeClaim {
  expectedClaimVersion: number;
  claimVersion: number;
  productOwnerActorId: string;
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductInitiativeClaimValidationError extends Error {}
export class ProductInitiativeClaimConflictError extends Error {}

export function prepareProductInitiativeClaim(
  current: CurrentProductInitiativeClaim,
  actorId: string,
  command: ProductInitiativeClaimCommandV1,
): PreparedProductInitiativeClaim {
  if (command.contractVersion !== "product-initiative-claim.v1") {
    invalid("contractVersion");
  }
  const normalizedActorId = text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedClaimVersion = version(command.expectedClaimVersion);
  // 先判归属再判版本：这两种情况的典型现场都是「页面读到时还没人接，点下去时已经被接了」，
  // 提示「已被领走」对人才有用；报「版本冲突」会让人以为自己点错了地方。
  if (current.productOwnerActorId) {
    conflict("PRODUCT_INITIATIVE_ALREADY_CLAIMED");
  }
  if (expectedClaimVersion !== current.claimVersion) {
    conflict("PRODUCT_INITIATIVE_CLAIM_VERSION_CONFLICT");
  }

  const normalized = {
    expectedClaimVersion,
    claimVersion: current.claimVersion + 1,
    productOwnerActorId: normalizedActorId,
    idempotencyKey,
  };
  return {
    ...normalized,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex"),
  };
}

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalid("expectedClaimVersion");
  }
  return value;
}

function invalid(field: string): never {
  throw new ProductInitiativeClaimValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

function conflict(code: string): never {
  throw new ProductInitiativeClaimConflictError(code);
}

/** 集成测试用的简写：以某人为负责人领取一份交接。 */
export function prepareProductDefinitionClaim(
  actorId: string,
  idempotencyKey: string,
): PreparedProductInitiativeClaim {
  return prepareProductInitiativeClaim(
    { claimVersion: 0, productOwnerActorId: null },
    actorId,
    {
      contractVersion: "product-initiative-claim.v1",
      expectedClaimVersion: 0,
      idempotencyKey,
    },
  );
}
