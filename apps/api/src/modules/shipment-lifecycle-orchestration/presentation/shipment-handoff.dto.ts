import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ManualDepartedShipmentCreateCommandV1,
  ShipmentHandoffCommandV1,
  ShipmentHandoffIssueV1,
  ShipmentHandoffObjectResultV1,
  InternalShipmentHandoffAcceptCommandV1,
  InternalShipmentHandoffBatchAcceptCommandV1,
  ShipmentPendingFactCompletionCommandV1,
  ShipmentPendingCargoCompletionCommandV1,
  ShipmentPendingSkuBindingCommandV1,
  ShipmentPendingDocumentCompletionCommandV1,
} from "@logix/contracts";

export class ManualDepartedShipmentCreateRequestDto implements ManualDepartedShipmentCreateCommandV1 {
  @ApiProperty({ enum: ["manual-departed-shipment-create.v1"] })
  contractVersion!: ManualDepartedShipmentCreateCommandV1["contractVersion"];
  @ApiProperty({ format: "uuid" }) requestId!: string;
  @ApiProperty({ minLength: 1, maxLength: 100 }) shipmentNumber!: string;
  @ApiPropertyOptional({ maxLength: 50 }) carrierCode?: string;
  @ApiPropertyOptional({ maxLength: 200 }) vesselName?: string;
  @ApiPropertyOptional({ maxLength: 100 }) voyageNumber?: string;
  @ApiPropertyOptional({ maxLength: 200 }) bookingNumber?: string;
  @ApiPropertyOptional({ pattern: "^[A-Z]{2}[A-Z0-9]{3}$" })
  originPortCode?: string;
  @ApiPropertyOptional({ pattern: "^[A-Z]{2}[A-Z0-9]{3}$" })
  destinationPortCode?: string;
  @ApiPropertyOptional({ format: "uuid" }) cargoOwnerReferenceId?: string;
  @ApiPropertyOptional({ format: "date-time" }) estimatedArrivalAt?: string;
  @ApiProperty({ type: [Object], minItems: 1, maxItems: 50 })
  containers!: ManualDepartedShipmentCreateCommandV1["containers"];
}

export class ShipmentIntakePortQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 100 }) query!: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 50 }) pageSize?: string;
  @ApiPropertyOptional({ pattern: "^[A-Z]{2}[A-Z0-9]{3}$" })
  cursor?: string;
}

export class InternalShipmentHandoffAcceptRequestDto {
  @ApiProperty({ enum: ["internal-shipment-handoff-accept.v1"] })
  contractVersion!: InternalShipmentHandoffAcceptCommandV1["contractVersion"];
  @ApiProperty() candidateRef!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class InternalShipmentHandoffBatchAcceptRequestDto {
  @ApiProperty({ enum: ["internal-shipment-handoff-batch-accept.v1"] })
  contractVersion!: InternalShipmentHandoffBatchAcceptCommandV1["contractVersion"];
  @ApiProperty({ type: [String], minItems: 1, maxItems: 500 })
  candidateRefs!: InternalShipmentHandoffBatchAcceptCommandV1["candidateRefs"];
  @ApiProperty() idempotencyKey!: string;
}

export class ShipmentPendingFactCompletionRequestDto implements ShipmentPendingFactCompletionCommandV1 {
  @ApiProperty({ enum: ["shipment-pending-fact-completion.v1"] })
  contractVersion!: ShipmentPendingFactCompletionCommandV1["contractVersion"];
  @ApiProperty({ minimum: 1 }) expectedRelationshipVersion!: number;
  @ApiProperty({ format: "date-time" }) occurredAt!: string;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ type: Object })
  facts!: ShipmentPendingFactCompletionCommandV1["facts"];
}

export class ShipmentPendingCargoCompletionRequestDto implements ShipmentPendingCargoCompletionCommandV1 {
  @ApiProperty({ enum: ["shipment-pending-cargo-completion.v1"] })
  contractVersion!: ShipmentPendingCargoCompletionCommandV1["contractVersion"];
  @ApiProperty({ minimum: 1 }) expectedRelationshipVersion!: number;
  @ApiProperty({ format: "date-time" }) occurredAt!: string;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ type: [Object] })
  lines!: ShipmentPendingCargoCompletionCommandV1["lines"];
}

export class ShipmentPendingSkuBindingRequestDto implements ShipmentPendingSkuBindingCommandV1 {
  @ApiProperty({ enum: ["shipment-pending-sku-binding.v1"] })
  contractVersion!: ShipmentPendingSkuBindingCommandV1["contractVersion"];
  @ApiProperty({ minimum: 1 }) expectedRelationshipVersion!: number;
  @ApiProperty({ minimum: 1 }) expectedCargoLineVersion!: number;
  @ApiProperty({ format: "date-time" }) occurredAt!: string;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ format: "uuid" }) cargoLineId!: string;
}

export class ShipmentPendingDocumentCompletionRequestDto implements ShipmentPendingDocumentCompletionCommandV1 {
  @ApiProperty({ enum: ["shipment-pending-document-completion.v1"] })
  contractVersion!: ShipmentPendingDocumentCompletionCommandV1["contractVersion"];
  @ApiProperty({ minimum: 1 }) expectedRelationshipVersion!: number;
  @ApiProperty({ format: "date-time" }) occurredAt!: string;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ type: [Object] })
  documents!: ShipmentPendingDocumentCompletionCommandV1["documents"];
}

export class ShipmentHandoffCommandRequestDto {
  @ApiProperty({ enum: ["shipment-handoff.v1"] })
  contractVersion!: ShipmentHandoffCommandV1["contractVersion"];
  @ApiProperty() tenantId!: string;
  @ApiProperty({
    enum: [
      "legacy_departed_file_v1",
      "packing_platform_v1",
      "internal_fulfillment_v1",
      "api_v1",
    ],
  })
  sourceProfile!: ShipmentHandoffCommandV1["sourceProfile"];
  @ApiProperty({ type: Object }) source!: ShipmentHandoffCommandV1["source"];
  @ApiProperty({ type: Object })
  shipment!: ShipmentHandoffCommandV1["shipment"];
  @ApiProperty({ type: [Object] })
  billsOfLading!: ShipmentHandoffCommandV1["billsOfLading"];
  @ApiProperty({ type: [Object] })
  containers!: ShipmentHandoffCommandV1["containers"];
  @ApiPropertyOptional({ type: [String] }) documentReferences?: string[];
  @ApiProperty({ type: [String] }) evidenceReferences!: string[];
}

export class ShipmentHandoffPreflightResponseDto {
  @ApiProperty({ enum: ["ready", "review_required", "rejected"] })
  decision!: "ready" | "review_required" | "rejected";
  @ApiPropertyOptional() duplicate?: boolean;
  @ApiProperty() payloadHash!: string;
  @ApiProperty({ type: [Object] }) issues!: ShipmentHandoffIssueV1[];
  @ApiProperty() traceId!: string;
}

export class ShipmentHandoffResultResponseDto {
  @ApiProperty() receptionState!: string;
  @ApiProperty() businessDecisionState!: string;
  @ApiProperty() commitState!: string;
  @ApiProperty() handoffId!: string;
  @ApiProperty() handoffVersion!: number;
  @ApiProperty() duplicate!: boolean;
  @ApiPropertyOptional() shipmentId?: string;
  @ApiProperty({ type: [Object] })
  containerResults!: ShipmentHandoffObjectResultV1[];
  @ApiProperty({ type: [Object] })
  cargoResults!: ShipmentHandoffObjectResultV1[];
  @ApiProperty({ type: [Object] })
  documentResults!: ShipmentHandoffObjectResultV1[];
  @ApiProperty() lifecycleInitializationState!: string;
  @ApiProperty() customsAssimilationState!: string;
  @ApiProperty() inlandAssimilationState!: string;
  @ApiProperty() warehouseAssimilationState!: string;
  @ApiProperty({ type: [Object] }) issues!: ShipmentHandoffIssueV1[];
  @ApiProperty() traceId!: string;
}
