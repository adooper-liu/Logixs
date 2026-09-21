import { ApiProperty } from "@nestjs/swagger";
import type { CargoReadyDecisionCode } from "../application/decide-cargo-ready-and-replay.service";

export class DecideCargoReadyComplianceRequestDto {
  @ApiProperty() assessmentId!: string;
  @ApiProperty() expectedDecisionVersion!: number;
  @ApiProperty({
    enum: [
      "approved",
      "approved_with_conditions",
      "blocked",
      "evidence_required",
    ],
  })
  decisionCode!: CargoReadyDecisionCode;
  @ApiProperty({ type: [String], required: false }) conditionRefs?: string[];
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class AssessCargoReadyComplianceRequestDto {
  @ApiProperty() jurisdictionCountryCode!: string;
  @ApiProperty({ example: "2026-09-20" }) assessmentDate!: string;
  @ApiProperty() expectedAssessmentVersion!: number;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class CargoReadyComplianceAssessmentWriteResponseDto {
  @ApiProperty() assessmentId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() state!: string;
  @ApiProperty() duplicate!: boolean;
  @ApiProperty() remediationCreated!: number;
  @ApiProperty() remediationCancelled!: number;
}

export class CargoReadyDecisionReplayDto {
  @ApiProperty({
    enum: [
      "not_requested",
      "no_pending_facts",
      "completed",
      "deferred",
      "retry_required",
    ],
  })
  status!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() claimed!: number;
  @ApiProperty() applied!: number;
  @ApiProperty() pending!: number;
  @ApiProperty() rejected!: number;
}

export class CargoReadyComplianceDecisionResponseDto {
  @ApiProperty() assessmentId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() state!: string;
  @ApiProperty() duplicate!: boolean;
  @ApiProperty({ type: CargoReadyDecisionReplayDto })
  replay!: CargoReadyDecisionReplayDto;
}
