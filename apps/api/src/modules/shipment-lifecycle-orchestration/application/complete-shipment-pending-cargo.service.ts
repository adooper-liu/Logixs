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
  ShipmentPendingCargoCompletionCommandV1,
  ShipmentPendingCargoCompletionResultV1,
} from "@logix/contracts";
import {
  REGISTER_EVIDENCE,
  type RegisterEvidencePort,
} from "../../document-records";
import {
  RESOLVE_PRODUCT_SKUS,
  type ResolveProductSkusPort,
} from "../../master-data";
import {
  SHIPMENT_PENDING_CARGO_COMPLETION,
  GetShipmentService,
  ShipmentPendingCargoCompletionConflictError,
  ShipmentPendingCargoCompletionNotFoundError,
  type ShipmentPendingCargoCompletionPort,
} from "../../shipment-registry";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;
const QUANTITY_UNITS = new Set(["piece", "carton", "set", "pallet"]);

@Injectable()
export class CompleteShipmentPendingCargoService {
  constructor(
    @Inject(REGISTER_EVIDENCE)
    private readonly registerEvidence: RegisterEvidencePort,
    @Inject(RESOLVE_PRODUCT_SKUS)
    private readonly resolveProductSkus: ResolveProductSkusPort,
    private readonly getShipment: GetShipmentService,
    @Inject(SHIPMENT_PENDING_CARGO_COMPLETION)
    private readonly completion: ShipmentPendingCargoCompletionPort,
  ) {}

  async execute(
    shipmentId: string,
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<ShipmentPendingCargoCompletionResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (!UUID_PATTERN.test(shipmentId)) {
      throw new BadRequestException("SHIPMENT_PENDING_CARGO_INVALID");
    }
    const command = normalizeCommand(input);
    const current = await this.getShipment.execute({
      tenantId: context.tenantId,
      id: shipmentId,
    });
    if (
      current.shipment.relationshipVersion !==
      command.expectedRelationshipVersion
    ) {
      throw new ConflictException("TARGET_SHIPMENT_VERSION_CONFLICT");
    }
    if (current.cargoLines.length > 0) {
      throw new ConflictException("SHIPMENT_CARGO_CORRECTION_REQUIRED");
    }
    const activeContainerIds = new Set(
      current.containers.map(({ containerRecordId }) => containerRecordId),
    );
    if (
      command.lines.some(
        ({ containerRecordId }) => !activeContainerIds.has(containerRecordId),
      )
    ) {
      throw new ConflictException("SHIPMENT_CONTAINER_REFERENCE_INVALID");
    }
    if (current.containers.some(({ allocations }) => allocations.length > 0)) {
      throw new ConflictException("CONTAINER_CARGO_CORRECTION_REQUIRED");
    }
    const productSkus = await this.resolveProductSkus.execute({
      tenantId: context.tenantId,
      productNumbers: command.lines.map(({ productNumber }) => productNumber),
    });
    const resolvedProductSkuIds = new Map(
      productSkus.map(({ productNumber, productSkuId }) => [
        productNumber,
        productSkuId,
      ]),
    );
    const traceId = deterministicTraceId(
      context.tenantId,
      shipmentId,
      command.idempotencyKey,
    );
    const evidenceDigest = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    const evidence = await this.registerEvidence.execute({
      tenantId: context.tenantId,
      idempotencyKey: `shipment-cargo-evidence:${createHash("sha256")
        .update(command.idempotencyKey)
        .digest("hex")}`,
      evidenceType: "attestation",
      subjectType: "domain_fact",
      subjectId: shipmentId,
      authorityLevel: "operational",
      contentRef: `logix://shipment/${shipmentId}/cargo-completion/${evidenceDigest}`,
      contentHash: evidenceDigest,
      sourceType: "person",
      originatorSystem: "logix",
      authoritySystem: "shipping_operations",
      ingestionChannel: "manual_ui",
      captureSource: "internal_operation",
    });
    try {
      const saved = await this.completion.complete({
        tenantId: context.tenantId,
        actorId: context.actorId,
        shipmentId,
        command,
        evidenceRef: evidence.id,
        resolvedProductSkuIds,
        traceId,
      });
      return {
        contractVersion: "shipment-pending-cargo-completion-result.v1",
        status: saved.duplicate ? "duplicate" : "saved",
        shipmentId,
        relationshipVersion: saved.relationshipVersion,
        cargoLineCount: saved.cargoLineCount,
        unmatchedSkuCount: saved.unmatchedSkuCount,
        traceId: saved.traceId,
      };
    } catch (error) {
      if (error instanceof ShipmentPendingCargoCompletionNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ShipmentPendingCargoCompletionConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}

function normalizeCommand(
  input: unknown,
): ShipmentPendingCargoCompletionCommandV1 {
  if (
    !isRecord(input) ||
    input.contractVersion !== "shipment-pending-cargo-completion.v1" ||
    !Number.isInteger(input.expectedRelationshipVersion) ||
    Number(input.expectedRelationshipVersion) < 1 ||
    typeof input.occurredAt !== "string" ||
    !isDateTime(input.occurredAt) ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length < 1 ||
    input.idempotencyKey.length > 200 ||
    !Array.isArray(input.lines) ||
    input.lines.length < 1 ||
    input.lines.length > 500 ||
    Object.keys(input).some(
      (key) =>
        ![
          "contractVersion",
          "expectedRelationshipVersion",
          "occurredAt",
          "idempotencyKey",
          "lines",
        ].includes(key),
    )
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_CARGO_INVALID");
  }
  const lines = input.lines.map(normalizeLine);
  return {
    contractVersion: "shipment-pending-cargo-completion.v1",
    expectedRelationshipVersion: Number(input.expectedRelationshipVersion),
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    lines: [lines[0]!, ...lines.slice(1)],
  };
}

function normalizeLine(
  value: unknown,
): ShipmentPendingCargoCompletionCommandV1["lines"][number] {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "containerRecordId",
          "productNumber",
          "quantity",
          "quantityUnit",
        ].includes(key),
    ) ||
    typeof value.containerRecordId !== "string" ||
    !UUID_PATTERN.test(value.containerRecordId) ||
    typeof value.productNumber !== "string" ||
    !value.productNumber.trim() ||
    value.productNumber.trim().length > 200 ||
    typeof value.quantity !== "string" ||
    !QUANTITY_PATTERN.test(value.quantity) ||
    Number(value.quantity) <= 0 ||
    typeof value.quantityUnit !== "string" ||
    !QUANTITY_UNITS.has(value.quantityUnit)
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_CARGO_INVALID");
  }
  return {
    containerRecordId: value.containerRecordId.toLowerCase(),
    productNumber: value.productNumber.trim(),
    quantity: normalizeQuantity(value.quantity),
    quantityUnit: value.quantityUnit as "piece" | "carton" | "set" | "pallet",
  };
}

function normalizeQuantity(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
}

function deterministicTraceId(
  tenantId: string,
  shipmentId: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(`${tenantId}:${shipmentId}:${idempotencyKey}`)
    .digest("hex");
  return `shipment-cargo-completion:${digest.slice(0, 32)}`;
}

function isDateTime(value: string): boolean {
  return (
    !Number.isNaN(Date.parse(value)) &&
    /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
