import { ApiProperty } from "@nestjs/swagger";

export class SubmitClientOperationRequestDto {
  @ApiProperty() actionCode!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ required: false }) payloadHash?: string;
  @ApiProperty({ required: false }) traceId?: string;
}

export class ClientOperationResponseDto {
  @ApiProperty() clientOperationId!: string;
  @ApiProperty() actionCode!: string;
  @ApiProperty() receptionState!: string;
  @ApiProperty() businessDecisionState!: string;
  @ApiProperty() commitState!: string;
  @ApiProperty({ nullable: true, type: String })
  rejectionReasonCode!: string | null;
  @ApiProperty({ type: [Object] })
  resultRefs!: Array<{ entityType: string; entityId: string }>;
  @ApiProperty() requestHash!: string;
  @ApiProperty() traceId!: string;
}
