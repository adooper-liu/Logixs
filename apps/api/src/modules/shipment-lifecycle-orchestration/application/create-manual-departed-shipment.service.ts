import { createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  ManualDepartedShipmentCreateCommandV1,
  ShipmentHandoffCommandV2,
  ShipmentHandoffResultV1,
} from "@logix/contracts";
import {
  CARGO_OWNER_DIRECTORY,
  REFERENCE_PORT_DIRECTORY,
  type CargoOwnerDirectoryPort,
  type ReferencePortDirectoryPort,
} from "../../master-data";
import {
  ShipmentHandoffContractValidationError,
  validateManualDepartedShipmentCreateCommand,
} from "../domain/shipment-handoff-contract";
import { AcceptShipmentHandoffService } from "./accept-shipment-handoff.service";

@Injectable()
export class CreateManualDepartedShipmentService {
  constructor(
    private readonly acceptHandoff: AcceptShipmentHandoffService,
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
    @Inject(CARGO_OWNER_DIRECTORY)
    private readonly cargoOwners: CargoOwnerDirectoryPort,
  ) {}

  async execute(
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<ShipmentHandoffResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const command = validateAndNormalize(input);
    const requestedPorts = [
      command.originPortCode,
      command.destinationPortCode,
    ].filter((value): value is string => Boolean(value));
    const ports = requestedPorts.length
      ? await this.ports.findByUnlocodes(requestedPorts)
      : [];
    if (
      new Set(ports.map(({ unlocode }) => unlocode)).size !==
      new Set(requestedPorts).size
    ) {
      throw new BadRequestException("UNKNOWN_REFERENCE_CODE");
    }
    const destination = ports.find(
      ({ unlocode }) => unlocode === command.destinationPortCode,
    );
    const cargoOwner = command.cargoOwnerReferenceId
      ? await this.cargoOwners.findActiveById(command.cargoOwnerReferenceId)
      : null;
    if (command.cargoOwnerReferenceId && !cargoOwner) {
      throw new BadRequestException("UNKNOWN_CARGO_OWNER_REFERENCE");
    }
    return this.acceptHandoff.accept(
      toHandoff(command, context.tenantId, destination?.areaCode, cargoOwner),
      { tenantId: context.tenantId, actorId: context.actorId },
    );
  }
}

function validateAndNormalize(
  input: unknown,
): ManualDepartedShipmentCreateCommandV1 {
  let command: ManualDepartedShipmentCreateCommandV1;
  try {
    command = validateManualDepartedShipmentCreateCommand(input);
  } catch (error) {
    if (error instanceof ShipmentHandoffContractValidationError) {
      throw new BadRequestException({
        code: error.message,
        details: error.validationErrors,
      });
    }
    throw error;
  }
  const shipmentNumber = command.shipmentNumber.trim();
  if (!shipmentNumber) {
    throw new BadRequestException("MANUAL_SHIPMENT_IDENTITY_REQUIRED");
  }
  return {
    ...command,
    shipmentNumber,
    ...(normalizeOptional(command.carrierCode, 50, "carrierCode")
      ? { carrierCode: command.carrierCode!.trim().toUpperCase() }
      : {}),
    ...(normalizeOptional(command.vesselName, 200, "vesselName")
      ? { vesselName: command.vesselName!.trim() }
      : {}),
    ...(normalizeOptional(command.voyageNumber, 100, "voyageNumber")
      ? { voyageNumber: command.voyageNumber!.trim() }
      : {}),
    ...(normalizeOptional(command.bookingNumber, 200, "bookingNumber")
      ? { bookingNumber: command.bookingNumber!.trim() }
      : {}),
    ...(command.originPortCode
      ? { originPortCode: command.originPortCode.toUpperCase() }
      : {}),
    ...(command.destinationPortCode
      ? { destinationPortCode: command.destinationPortCode.toUpperCase() }
      : {}),
    containers: command.containers.map((container) => ({
      containerNumber: container.containerNumber.trim().toUpperCase(),
      ...(container.containerTypeCode?.trim()
        ? {
            containerTypeCode: container.containerTypeCode.trim().toUpperCase(),
          }
        : {}),
    })) as ManualDepartedShipmentCreateCommandV1["containers"],
  };
}

function normalizeOptional(
  value: string | undefined,
  maxLength: number,
  field: string,
): boolean {
  if (value === undefined) return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BadRequestException(
      `MANUAL_SHIPMENT_${field.toUpperCase()}_INVALID`,
    );
  }
  return true;
}

function toHandoff(
  input: ManualDepartedShipmentCreateCommandV1,
  tenantId: string,
  destinationCountryCode: string | undefined,
  cargoOwner: {
    id: string;
    legalName: string;
    salesCountryCode: string;
  } | null,
): ShipmentHandoffCommandV2 {
  const occurredAt = new Date().toISOString();
  const traceDigest = createHash("sha256")
    .update(`${tenantId}:${input.requestId}`)
    .digest("hex")
    .slice(0, 32);
  const [firstContainer, ...remainingContainers] = input.containers;
  return {
    contractVersion: "shipment-handoff.v2",
    tenantId,
    sourceProfile: "api_v1",
    source: {
      channel: "manual",
      system: "logix.workbench",
      externalHandoffId: `manual:${input.requestId}`,
      handoffVersion: 1,
      occurredAt,
      idempotencyKey: `manual-shipment:${input.requestId}`,
      correlationId: input.requestId,
      traceId: `manual-shipment:${traceDigest}`,
    },
    shipment: {
      externalShipmentId: `manual:${input.requestId}`,
      shipmentNumber: input.shipmentNumber,
      transportMode: "ocean",
      ...(input.carrierCode ? { carrierCode: input.carrierCode } : {}),
      ...(input.vesselName ? { vesselName: input.vesselName } : {}),
      ...(input.voyageNumber ? { voyageNumber: input.voyageNumber } : {}),
      ...(input.bookingNumber ? { bookingNumber: input.bookingNumber } : {}),
      ...(input.originPortCode ? { originPortCode: input.originPortCode } : {}),
      ...(input.destinationPortCode
        ? { destinationPortCode: input.destinationPortCode }
        : {}),
      ...(destinationCountryCode ? { destinationCountryCode } : {}),
      ...(cargoOwner
        ? {
            cargoOwnerReferenceId: cargoOwner.id,
            cargoOwnerName: cargoOwner.legalName,
            salesCountryCode: cargoOwner.salesCountryCode,
          }
        : {}),
      ...(input.estimatedArrivalAt
        ? { estimatedArrivalAt: input.estimatedArrivalAt }
        : {}),
    },
    billsOfLading: [],
    containers: [
      toHandoffContainer(firstContainer, 0),
      ...remainingContainers.map((container, index) =>
        toHandoffContainer(container, index + 1),
      ),
    ],
    evidenceReferences: [],
  };
}

function toHandoffContainer(
  container: ManualDepartedShipmentCreateCommandV1["containers"][number],
  index: number,
): ShipmentHandoffCommandV2["containers"][number] {
  return {
    referenceId: `manual-container-${index + 1}`,
    externalContainerId: container.containerNumber,
    containerNumber: container.containerNumber,
    ...(container.containerTypeCode
      ? { containerTypeCode: container.containerTypeCode }
      : {}),
    billReferences: [],
    upstreamReferences: [],
  };
}
