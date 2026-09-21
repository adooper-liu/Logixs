import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  CustomsClearanceCase,
  ReplaceCustomsClearanceCaseCommand,
} from "@logix/contracts";

export class ReplaceCustomsClearanceCaseRequestDto implements ReplaceCustomsClearanceCaseCommand {
  @ApiProperty() expectedVersion!: number;
  @ApiProperty({ minLength: 2, maxLength: 2 })
  jurisdictionCountryCode!: string;
  @ApiPropertyOptional({ nullable: true }) customsBrokerPartyId!: string | null;
  @ApiPropertyOptional({ nullable: true }) declarationNumber!: string | null;
  @ApiProperty({ enum: ["not_filed", "filed", "accepted"] })
  filingState!: "not_filed" | "filed" | "accepted";
  @ApiProperty({ enum: ["pending", "held", "released"] })
  decisionState!: "pending" | "held" | "released";
  @ApiProperty({ type: [String] }) activeHoldCodes!: string[];
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class CustomsClearanceCaseDto implements CustomsClearanceCase {
  @ApiProperty() caseId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() jurisdictionCountryCode!: string;
  @ApiPropertyOptional({ nullable: true }) customsBrokerPartyId!: string | null;
  @ApiPropertyOptional({ nullable: true }) declarationNumber!: string | null;
  @ApiProperty({ enum: ["not_filed", "filed", "accepted"] })
  filingState!: "not_filed" | "filed" | "accepted";
  @ApiProperty({ enum: ["pending", "held", "released"] })
  decisionState!: "pending" | "held" | "released";
  @ApiProperty({ type: [String] }) activeHoldCodes!: string[];
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() duplicate!: boolean;
}
