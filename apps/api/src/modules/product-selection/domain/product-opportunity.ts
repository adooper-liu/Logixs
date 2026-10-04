import { createHash } from "node:crypto";
import type {
  MarketOpportunityResponsibilityProjectionV1,
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

export function projectMarketOpportunityResponsibility(input: {
  intakeState: MarketOpportunityIntakeStateV1;
  handedOffAt: string;
  assignedActorId: string | null;
  claimedAt: Date | null;
  acceptedAt: Date | null;
}): MarketOpportunityResponsibilityProjectionV1 {
  if (input.intakeState === "superseded") {
    return {
      status: "superseded",
      responsibleTeamCode: null,
      handedOffAt: input.handedOffAt,
      assignedActorId: null,
      claimedAt: input.claimedAt?.toISOString() ?? null,
      acceptedAt: input.acceptedAt?.toISOString() ?? null,
    };
  }
  const accepted = input.intakeState === "accepted";
  return {
    status: accepted ? "transferred_to_selection" : "retained_by_market",
    responsibleTeamCode: accepted ? "product_selection" : "market_intelligence",
    handedOffAt: input.handedOffAt,
    assignedActorId: input.assignedActorId,
    claimedAt: input.claimedAt?.toISOString() ?? null,
    acceptedAt: input.acceptedAt?.toISOString() ?? null,
  };
}

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
