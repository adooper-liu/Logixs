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
  ShipmentPendingSkuBindingCommandV1,
  ShipmentPendingSkuBindingResultV1,
} from "@logix/contracts";
import {
  REGISTER_PRODUCT_SKU,
  RESOLVE_PRODUCT_SKUS,
  type RegisterProductSkuPort,
  type ResolveProductSkusPort,
} from "../../master-data";
import {
  SHIPMENT_PENDING_SKU_BINDING,
  GetShipmentService,
  ShipmentPendingSkuBindingConflictError,
  ShipmentPendingSkuBindingNotFoundError,
  type ShipmentPendingSkuBindingPort,
} from "../../shipment-registry";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class BindShipmentPendingSkuService {
  constructor(
    @Inject(RESOLVE_PRODUCT_SKUS)
    private readonly resolveProductSkus: ResolveProductSkusPort,
    @Inject(REGISTER_PRODUCT_SKU)
    private readonly registerProductSku: RegisterProductSkuPort,
    private readonly getShipment: GetShipmentService,
    @Inject(SHIPMENT_PENDING_SKU_BINDING)
    private readonly binding: ShipmentPendingSkuBindingPort,
  ) {}

  async execute(
    shipmentId: string,
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<ShipmentPendingSkuBindingResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (!UUID_PATTERN.test(shipmentId)) {
      throw new BadRequestException("SHIPMENT_PENDING_SKU_BINDING_INVALID");
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
    const cargoLine = current.cargoLines.find(
      ({ id }) => id === command.cargoLineId,
    );
    if (!cargoLine) {
      throw new NotFoundException("SHIPMENT_CARGO_LINE_NOT_FOUND");
    }
    const replayCandidate =
      Boolean(cargoLine.productSkuId) &&
      cargoLine.version === command.expectedCargoLineVersion + 1;
    if (
      cargoLine.version !== command.expectedCargoLineVersion &&
      !replayCandidate
    ) {
      throw new ConflictException("SHIPMENT_CARGO_LINE_VERSION_CONFLICT");
    }

    const [matched] = await this.resolveProductSkus.execute({
      tenantId: context.tenantId,
      productNumbers: [cargoLine.productNumber],
    });
    const registered =
      matched || cargoLine.productSkuId
        ? null
        : await this.registerProductSku.execute({
            tenantId: context.tenantId,
            productNumber: cargoLine.productNumber,
            idempotencyKey: `shipment-sku-registration:${createHash("sha256")
              .update(command.idempotencyKey)
              .digest("hex")}`,
          });
    const productSkuId =
      cargoLine.productSkuId ??
      matched?.productSkuId ??
      registered!.productSkuId;
    const skuResolution = matched ? "matched_existing" : "registered";
    const traceId = deterministicTraceId(
      context.tenantId,
      shipmentId,
      command.idempotencyKey,
    );
    try {
      const saved = await this.binding.bind({
        tenantId: context.tenantId,
        actorId: context.actorId,
        shipmentId,
        command,
        productSkuId,
        productNumber: cargoLine.productNumber,
        skuResolution,
        traceId,
      });
      return {
        contractVersion: "shipment-pending-sku-binding-result.v1",
        status: saved.duplicate ? "duplicate" : "saved",
        shipmentId,
        relationshipVersion: saved.relationshipVersion,
        cargoLineId: command.cargoLineId,
        cargoLineVersion: saved.cargoLineVersion,
        productSkuId,
        productNumber: cargoLine.productNumber,
        skuResolution: saved.skuResolution,
        traceId: saved.traceId,
      };
    } catch (error) {
      if (error instanceof ShipmentPendingSkuBindingNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ShipmentPendingSkuBindingConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}

function normalizeCommand(input: unknown): ShipmentPendingSkuBindingCommandV1 {
  if (
    !isRecord(input) ||
    input.contractVersion !== "shipment-pending-sku-binding.v1" ||
    !Number.isInteger(input.expectedRelationshipVersion) ||
    Number(input.expectedRelationshipVersion) < 1 ||
    !Number.isInteger(input.expectedCargoLineVersion) ||
    Number(input.expectedCargoLineVersion) < 1 ||
    typeof input.occurredAt !== "string" ||
    !isDateTime(input.occurredAt) ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length < 1 ||
    input.idempotencyKey.length > 200 ||
    typeof input.cargoLineId !== "string" ||
    !UUID_PATTERN.test(input.cargoLineId) ||
    Object.keys(input).some(
      (key) =>
        ![
          "contractVersion",
          "expectedRelationshipVersion",
          "expectedCargoLineVersion",
          "occurredAt",
          "idempotencyKey",
          "cargoLineId",
        ].includes(key),
    )
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_SKU_BINDING_INVALID");
  }
  return {
    contractVersion: "shipment-pending-sku-binding.v1",
    expectedRelationshipVersion: Number(input.expectedRelationshipVersion),
    expectedCargoLineVersion: Number(input.expectedCargoLineVersion),
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    cargoLineId: input.cargoLineId.toLowerCase(),
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
  return `shipment-sku-binding:${digest.slice(0, 32)}`;
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
