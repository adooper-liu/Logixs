import { createHash } from "node:crypto";
import type { ProductInitiativeNpiReturnCommandV1 } from "@logix/contracts";
import {
  ProductInitiativeConflictError,
  ProductInitiativeValidationError,
} from "./product-initiative";

/**
 * NPI → 选品退回：理由必填才关闭并回推选品；缺理由明确失败（不静默保存半态）。
 * 与选品→经营 `return_to_market` 分轨，不复用其 outcome。
 */

export interface CurrentProductInitiativeForNpiReturn {
  version: number;
  currentDestination: string;
  productOwnerActorId: string | null;
}

export interface PreparedProductInitiativeNpiReturn {
  expectedVersion: number;
  version: number;
  outcome: "returned_from_npi";
  completion: "completed";
  nextDestination: "returned_from_npi";
  reason: string;
  responsibleActorId: string;
  idempotencyKey: string;
  payloadHash: string;
}

export function prepareProductInitiativeNpiReturn(
  current: CurrentProductInitiativeForNpiReturn,
  actorId: string,
  command: ProductInitiativeNpiReturnCommandV1,
): PreparedProductInitiativeNpiReturn {
  if (command.contractVersion !== "product-initiative-npi-return.v1") {
    invalid("contractVersion");
  }
  const responsibleActorId = text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const reason = text(command.returnReason, "returnReason", 500);
  const expectedVersion = version(command.expectedInitiativeVersion);

  if (current.currentDestination !== "handed_off") {
    conflict("PRODUCT_INITIATIVE_NPI_RETURN_NOT_HANDED_OFF");
  }
  if (!current.productOwnerActorId) {
    conflict("PRODUCT_INITIATIVE_NPI_RETURN_NOT_CLAIMED");
  }
  if (current.productOwnerActorId !== responsibleActorId) {
    conflict("PRODUCT_INITIATIVE_NPI_RETURN_NOT_OWNER");
  }
  if (expectedVersion !== current.version) {
    conflict("PRODUCT_INITIATIVE_VERSION_CONFLICT");
  }

  const normalized = {
    expectedVersion,
    version: current.version + 1,
    outcome: "returned_from_npi" as const,
    completion: "completed" as const,
    nextDestination: "returned_from_npi" as const,
    reason,
    responsibleActorId,
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
  if (typeof value !== "string") {
    throw new ProductInitiativeValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new ProductInitiativeValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return normalized;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ProductInitiativeValidationError(
      "VALIDATION_FORMAT: expectedInitiativeVersion",
    );
  }
  return value;
}

function invalid(field: string): never {
  throw new ProductInitiativeValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new ProductInitiativeConflictError(code);
}
