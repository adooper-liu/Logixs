import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class TaskAssistantRefDto {
  @ApiProperty() kind!: string;
  @ApiProperty() id!: string;
}

export class GenerateTaskActionCandidateRequestDto {
  @ApiProperty({ enum: ["task-action-candidate-generate.v1"] })
  contractVersion!: "task-action-candidate-generate.v1";
  @ApiProperty({ type: TaskAssistantRefDto })
  subjectRef!: { kind: "container"; id: string };
  @ApiProperty({ type: TaskAssistantRefDto })
  workRef!: { kind: "node_task"; id: string };
}

export class ConfirmTaskActionCandidateRequestDto {
  @ApiProperty({ enum: ["task-action-candidate-confirm.v1"] })
  contractVersion!: "task-action-candidate-confirm.v1";
  @ApiProperty() candidateId!: string;
  @ApiProperty() candidateHash!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class RejectTaskActionCandidateRequestDto {
  @ApiProperty({ enum: ["task-action-candidate-reject.v1"] })
  contractVersion!: "task-action-candidate-reject.v1";
  @ApiProperty() candidateId!: string;
  @ApiPropertyOptional() reason?: string;
}

export class TaskActionCandidateResponseDto {
  @ApiProperty() candidateId!: string;
}

export class TaskActionDecisionResponseDto {
  @ApiProperty() decisionId!: string;
}

export class TaskActionConfirmResponseDto {
  @ApiProperty({ enum: ["task-action-candidate-confirm-result.v1"] })
  contractVersion!: "task-action-candidate-confirm-result.v1";
}
