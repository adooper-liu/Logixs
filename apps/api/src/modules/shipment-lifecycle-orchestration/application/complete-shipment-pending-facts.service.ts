import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ShipmentPendingFactCompletionCommandV1,
  ShipmentPendingFactCompletionResultV1,
} from "@logix/contracts";
import {
  GetShipmentService,
  SHIPMENT_PENDING_FACT_COMPLETION,
  ShipmentPendingFactCompletionConflictError,
  ShipmentPendingFactCompletionNotFoundError,
  type ShipmentPendingFactCompletionPort,
} from "../../shipment-registry";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PORT_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;
const ALLOWED_FACT_KEYS = new Set([
  "carrierCode",
  "vesselName",
  "voyageNumber",
  "originPortCode",
  "destinationPortCode",
  "departureProof",
]);

@Injectable()
export class CompleteShipmentPendingFactsService {
  constructor(
    private readonly getShipment: GetShipmentService,
    @Inject(SHIPMENT_PENDING_FACT_COMPLETION)
    private readonly completion: ShipmentPendingFactCompletionPort,
  ) {}

  async execute(
    shipmentId: string,
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<ShipmentPendingFactCompletionResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (!UUID_PATTERN.test(shipmentId)) {
      throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
    }
    const command = normalizeCommand(input);
    const current = await this.getShipment.execute({
      tenantId: context.tenantId,
      id: shipmentId,
    });
    const traceId = deterministicTraceId(
      context.tenantId,
      shipmentId,
      command.idempotencyKey,
    );
    const facts = command.facts;
    if (Object.keys(facts).length === 0) {
      return {
        contractVersion: "shipment-pending-fact-completion-result.v1",
        status: "no_change",
        shipmentId,
        relationshipVersion: current.shipment.relationshipVersion,
        traceId,
      };
    }
    try {
      const saved = await this.completion.complete({
        tenantId: context.tenantId,
        actorId: context.actorId,
        shipmentId,
        command,
        traceId,
      });
      return {
        contractVersion: "shipment-pending-fact-completion-result.v1",
        status: "saved",
        shipmentId,
        relationshipVersion: saved.relationshipVersion,
        traceId: saved.traceId,
      };
    } catch (error) {
      if (error instanceof ShipmentPendingFactCompletionNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ShipmentPendingFactCompletionConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}

function normalizeCommand(
  input: unknown,
): ShipmentPendingFactCompletionCommandV1 {
  if (!isRecord(input) || !isRecord(input.facts)) {
    throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
  }
  if (
    input.contractVersion !== "shipment-pending-fact-completion.v1" ||
    !Number.isInteger(input.expectedRelationshipVersion) ||
    Number(input.expectedRelationshipVersion) < 1 ||
    typeof input.occurredAt !== "string" ||
    !isDateTime(input.occurredAt) ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length < 1 ||
    input.idempotencyKey.length > 200 ||
    Object.keys(input.facts).some((key) => !ALLOWED_FACT_KEYS.has(key))
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
  }

  const carrierCode = optionalText(input.facts.carrierCode, 50);
  const vesselName = optionalText(input.facts.vesselName, 200);
  const voyageNumber = optionalText(input.facts.voyageNumber, 100);
  const originPortCode = optionalPort(input.facts.originPortCode);
  const destinationPortCode = optionalPort(input.facts.destinationPortCode);
  const departureProof = optionalDepartureProof(input.facts.departureProof);
  return {
    contractVersion: "shipment-pending-fact-completion.v1",
    expectedRelationshipVersion: Number(input.expectedRelationshipVersion),
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    facts: {
      ...(carrierCode ? { carrierCode } : {}),
      ...(vesselName ? { vesselName } : {}),
      ...(voyageNumber ? { voyageNumber } : {}),
      ...(originPortCode ? { originPortCode } : {}),
      ...(destinationPortCode ? { destinationPortCode } : {}),
      ...(departureProof ? { departureProof } : {}),
    },
  };
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
  }
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) {
    throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
  }
  return normalized;
}

function optionalPort(value: unknown): string | undefined {
  const normalized = optionalText(value, 5)?.toUpperCase();
  if (normalized && !PORT_PATTERN.test(normalized)) {
    throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
  }
  return normalized;
}

function optionalDepartureProof(
  value: unknown,
): ShipmentPendingFactCompletionCommandV1["facts"]["departureProof"] {
  if (value === null || value === undefined) return undefined;
  if (
    !isRecord(value) ||
    value.kind !== "actual_departure_time" ||
    Object.keys(value).some(
      (key) =>
        !["kind", "occurredAt", "sourceTimezone", "evidenceRef"].includes(key),
    ) ||
    typeof value.occurredAt !== "string" ||
    !isDateTime(value.occurredAt) ||
    typeof value.sourceTimezone !== "string" ||
    value.sourceTimezone.length < 1 ||
    value.sourceTimezone.length > 100 ||
    value.sourceTimezone !== value.sourceTimezone.trim() ||
    !isIanaTimezone(value.sourceTimezone) ||
    typeof value.evidenceRef !== "string" ||
    !UUID_PATTERN.test(value.evidenceRef)
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_FACTS_INVALID");
  }
  return {
    kind: "actual_departure_time",
    occurredAt: value.occurredAt,
    sourceTimezone: value.sourceTimezone,
    evidenceRef: value.evidenceRef,
  };
}

function deterministicTraceId(
  tenantId: string,
  shipmentId: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(`${tenantId}:${shipmentId}:${idempotencyKey}`)
    .digest("hex");
  return `shipment-completion:${digest.slice(0, 32)}`;
}

function isDateTime(value: string): boolean {
  return (
    !Number.isNaN(Date.parse(value)) &&
    /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)
  );
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
