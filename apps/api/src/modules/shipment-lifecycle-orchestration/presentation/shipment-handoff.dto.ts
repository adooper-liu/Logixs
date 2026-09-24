import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffIssueV1,
  ShipmentHandoffObjectResultV1,
} from "@logix/contracts";

export class ShipmentHandoffCommandRequestDto {
  @ApiProperty({ enum: ["shipment-handoff.v1"] })
  contractVersion!: ShipmentHandoffCommandV1["contractVersion"];
  @ApiProperty() tenantId!: string;
  @ApiProperty({
    enum: ["legacy_departed_file_v1", "packing_platform_v1", "api_v1"],
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
