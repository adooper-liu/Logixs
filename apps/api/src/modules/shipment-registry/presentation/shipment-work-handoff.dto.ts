import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ShipmentWorkHandoffClaimCommandV1,
  ShipmentWorkHandoffCloseCommandV1,
  ShipmentWorkHandoffRaiseCommandV1,
} from "@logix/contracts";

const RECIPIENTS = ["customs", "pickup", "delivery", "unloading"] as const;
const STATES = ["raised", "claimed", "closed"] as const;

export class ShipmentWorkHandoffResponseDto {
  @ApiProperty({ enum: ["shipment-work-handoff.v1"] })
  contractVersion!: string;
  @ApiProperty() handoffId!: string;
  @ApiProperty() shipmentId!: string;
  @ApiPropertyOptional({ nullable: true }) containerRecordId!: string | null;
  @ApiProperty({ enum: RECIPIENTS }) recipientQueueCode!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) detail!: string | null;
  @ApiProperty({ enum: STATES }) state!: string;
  @ApiProperty() version!: number;
  @ApiProperty() raisedBy!: string;
  @ApiProperty() raisedAt!: string;
  @ApiPropertyOptional({ nullable: true }) claimedByActorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) claimedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) closedByActorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) closedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) conclusion!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ShipmentWorkHandoffQueuePageResponseDto {
  @ApiProperty({ enum: ["shipment-work-handoff-queue.v1"] })
  contractVersion!: string;
  @ApiProperty({ enum: RECIPIENTS }) recipientQueueCode!: string;
  @ApiProperty({ type: [ShipmentWorkHandoffResponseDto] })
  items!: ShipmentWorkHandoffResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}

export class ShipmentWorkHandoffRaiseRequestDto implements ShipmentWorkHandoffRaiseCommandV1 {
  @ApiProperty({ enum: ["shipment-work-handoff-raise.v1"] })
  contractVersion!: "shipment-work-handoff-raise.v1";
  @ApiProperty() shipmentId!: string;
  @ApiPropertyOptional({ nullable: true }) containerRecordId?: string | null;
  @ApiProperty({ enum: RECIPIENTS })
  recipientQueueCode!: ShipmentWorkHandoffRaiseCommandV1["recipientQueueCode"];
  @ApiProperty() title!: string;
  @ApiPropertyOptional() detail?: string;
  @ApiProperty() idempotencyKey!: string;
}

export class ShipmentWorkHandoffClaimRequestDto implements ShipmentWorkHandoffClaimCommandV1 {
  @ApiProperty({ enum: ["shipment-work-handoff-claim.v1"] })
  contractVersion!: "shipment-work-handoff-claim.v1";
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

export class ShipmentWorkHandoffCloseRequestDto implements ShipmentWorkHandoffCloseCommandV1 {
  @ApiProperty({ enum: ["shipment-work-handoff-close.v1"] })
  contractVersion!: "shipment-work-handoff-close.v1";
  @ApiProperty() expectedVersion!: number;
  @ApiProperty({
    description: "怎么了结的。必填 —— 交出去的人靠这句话判断下一步。",
  })
  conclusion!: string;
  @ApiProperty() idempotencyKey!: string;
}
