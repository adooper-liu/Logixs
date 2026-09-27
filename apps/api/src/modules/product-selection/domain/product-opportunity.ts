import { createHash } from "node:crypto";
import type {
  MarketOpportunityIntakeStateV1,
  ProductOpportunityIntakeCommandV1,
} from "@logix/contracts";

export interface CurrentOpportunityIntake {
  version: number;
  state: MarketOpportunityIntakeStateV1;
  assignedActorId: string | null;
}

export interface PreparedOpportunityIntake {
  expectedVersion: number;
  state: "claimed" | "accepted";
  assignedActorId: string;
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductOpportunityValidationError extends Error {}
export class ProductOpportunityConflictError extends Error {}
export class ProductOpportunityNotFoundError extends Error {}

export function prepareOpportunityIntake(
  current: CurrentOpportunityIntake,
  actorId: string,
  command: ProductOpportunityIntakeCommandV1,
): PreparedOpportunityIntake {
  if (command.contractVersion !== "product-opportunity-intake.v1") {
    invalid("contractVersion");
  }
  const normalizedActorId = text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedVersion = version(command.expectedIntakeVersion);
  if (expectedVersion !== current.version)
    conflict("PRODUCT_OPPORTUNITY_VERSION_CONFLICT");

  let state: PreparedOpportunityIntake["state"];
  if (command.action === "claim") {
    if (current.state !== "queued")
      conflict("PRODUCT_OPPORTUNITY_ALREADY_CLAIMED");
    state = "claimed";
  } else if (command.action === "accept") {
    if (current.state !== "claimed")
      conflict("PRODUCT_OPPORTUNITY_NOT_CLAIMED");
    if (current.assignedActorId !== normalizedActorId) {
      conflict("PRODUCT_OPPORTUNITY_ASSIGNEE_CONFLICT");
    }
    state = "accepted";
  } else {
    invalid("action");
  }

  const normalized = {
    expectedVersion,
    state,
    assignedActorId: normalizedActorId,
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
  if (!Number.isSafeInteger(value) || value < 0)
    invalid("expectedIntakeVersion");
  return value;
}

function invalid(field: string): never {
  throw new ProductOpportunityValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new ProductOpportunityConflictError(code);
}
