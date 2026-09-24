import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  InternalShipmentHandoffAcceptCommandV1,
  InternalShipmentHandoffAcceptResultV1,
  InternalShipmentHandoffCandidateV1,
  ShipmentHandoffCommandV2,
} from "@logix/contracts";
import {
  INTERNAL_SHIPMENT_HANDOFF_SOURCE,
  type InternalShipmentHandoffSourcePort,
} from "../../shipment-registry";
import { AcceptShipmentHandoffService } from "./accept-shipment-handoff.service";

@Injectable()
export class AcceptInternalShipmentHandoffService {
  constructor(
    @Inject(INTERNAL_SHIPMENT_HANDOFF_SOURCE)
    private readonly source: InternalShipmentHandoffSourcePort,
    private readonly acceptHandoff: AcceptShipmentHandoffService,
  ) {}

  async execute(
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<InternalShipmentHandoffAcceptResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const command = validateCommand(input);
    const candidate = await this.source.findCandidate({
      tenantId: context.tenantId,
      candidateRef: command.candidateRef,
    });
    if (!candidate) {
      throw new ConflictException(
        "INTERNAL_HANDOFF_CANDIDATE_STALE_OR_ACCEPTED",
      );
    }
    const handoff = await this.acceptHandoff.accept(
      toHandoffCommand(candidate, context.tenantId, command.idempotencyKey),
      { tenantId: context.tenantId, actorId: context.actorId },
    );
    return {
      contractVersion: "internal-shipment-handoff-accept-result.v1",
      candidateRef: candidate.candidateRef,
      handoff,
    };
  }
}

function validateCommand(
  input: unknown,
): InternalShipmentHandoffAcceptCommandV1 {
  const value = input as Partial<InternalShipmentHandoffAcceptCommandV1> | null;
  if (
    value?.contractVersion !== "internal-shipment-handoff-accept.v1" ||
    typeof value.candidateRef !== "string" ||
    !/^internal:[a-f0-9]{64}$/.test(value.candidateRef) ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length < 1 ||
    value.idempotencyKey.length > 200
  ) {
    throw new BadRequestException("VALIDATION_FORMAT");
  }
  return value as InternalShipmentHandoffAcceptCommandV1;
}

function toHandoffCommand(
  candidate: InternalShipmentHandoffCandidateV1,
  tenantId: string,
  idempotencyKey: string,
): ShipmentHandoffCommandV2 {
  const correlationId = randomUUID();
  const evidenceReferences = candidate.departureEvidenceRef
    ? [candidate.departureEvidenceRef]
    : [];
  return {
    contractVersion: "shipment-handoff.v2",
    tenantId,
    sourceProfile: "internal_fulfillment_v1",
    source: {
      channel: "api",
      system: "logix.internal_fulfillment",
      externalHandoffId: candidate.candidateRef,
      handoffVersion: 1,
      occurredAt: candidate.departedAt,
      idempotencyKey,
      mappingVersion: "internal_fulfillment_v1",
      correlationId,
      traceId: correlationId,
    },
    shipment: {
      externalShipmentId: candidate.candidateRef,
      transportMode: "ocean",
      carrierCode: candidate.carrierCode,
      vesselName: candidate.vesselName,
      voyageNumber: candidate.voyageNumber,
      bookingNumber: candidate.bookingNumber,
      ...(candidate.originPortCode
        ? { originPortCode: candidate.originPortCode }
        : {}),
      ...(candidate.destinationPortCode
        ? {
            destinationPortCode: candidate.destinationPortCode,
            destinationCountryCode: candidate.destinationPortCode.slice(0, 2),
          }
        : {}),
      ...(candidate.departureEvidenceRef
        ? {
            departureProof: {
              kind: "actual_departure_time" as const,
              occurredAt: candidate.departedAt,
              sourceTimezone: candidate.departureSourceTimezone,
              evidenceRef: candidate.departureEvidenceRef,
            },
          }
        : {}),
    },
    billsOfLading: candidate.transportDocuments.map((document) => ({
      referenceId: document.referenceId,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      version: 1,
    })),
    containers: candidate.containers.map((container) => {
      const cargo = candidate.cargoLines.filter(
        ({ containerRecordId }) =>
          containerRecordId === container.containerRecordId,
      );
      return {
        referenceId: container.containerRecordId,
        externalContainerId: container.containerRecordId,
        containerNumber: container.containerNumber,
        containerTypeCode: container.containerTypeCode,
        stuffingSnapshotRef: container.stuffingSnapshotRef,
        billReferences: candidate.transportDocuments
          .filter(({ containerRecordIds }) =>
            containerRecordIds.includes(container.containerRecordId),
          )
          .map(({ referenceId }) => referenceId),
        upstreamReferences: cargo.map((line) => ({
          referenceType: "stocking_order" as const,
          sourceSystem: "logix.shipment_registry",
          sourceRecordId: line.replenishmentOrderNumber,
          sourceVersion: "1",
          sourceLineId: line.replenishmentOrderLineId,
        })),
        ...(cargo.length
          ? {
              cargoAllocations: cargo.map((line) => ({
                sourceLineId: line.replenishmentOrderLineId,
                ...(line.productSkuId
                  ? { productSkuId: line.productSkuId }
                  : {}),
                productNumber: line.productNumber,
                quantity: line.quantity,
                quantityUnit: line.quantityUnit,
                ...(line.packageCount
                  ? {
                      packageCount: line.packageCount,
                      packageUnit: line.packageUnit!,
                    }
                  : {}),
                ...(line.grossWeight
                  ? { grossWeight: line.grossWeight, weightUnit: "kg" as const }
                  : {}),
                ...(line.volume
                  ? { volume: line.volume, volumeUnit: "m3" as const }
                  : {}),
                replenishmentOrderLineId: line.replenishmentOrderLineId,
              })),
            }
          : {}),
      };
    }) as ShipmentHandoffCommandV2["containers"],
    evidenceReferences,
  };
}
