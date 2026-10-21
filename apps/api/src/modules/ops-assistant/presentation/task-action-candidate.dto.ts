import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ConfirmTaskActionCandidateCommandV1,
  GenerateTaskActionCandidateCommandV1,
  RejectTaskActionCandidateCommandV1,
  TaskActionCandidateSourceV1,
  TaskActionCandidateV1,
  TaskActionClaimWorkOrderResultV1,
  TaskActionConfirmResultV1,
  TaskActionDecisionV1,
  TaskActionInputRefV1,
  TaskActionResultRefV1,
  TaskAssistantContextRefV1,
  TaskAssistantSubjectRefV1,
  TaskAssistantWorkRefV1,
} from "@logix/contracts";

class TaskAssistantSubjectRefDto implements TaskAssistantSubjectRefV1 {
  @ApiProperty({ type: String, enum: ["container"] })
  kind!: "container";

  @ApiProperty({ type: String, format: "uuid" })
  id!: string;
}

class TaskAssistantWorkRefDto implements TaskAssistantWorkRefV1 {
  @ApiProperty({ type: String, enum: ["node_task"] })
  kind!: "node_task";

  @ApiProperty({ type: String, format: "uuid" })
  id!: string;
}

class TaskAssistantContextRefDto implements TaskAssistantContextRefV1 {
  @ApiProperty({ type: TaskAssistantSubjectRefDto })
  subjectRef!: TaskAssistantSubjectRefV1;

  @ApiProperty({ type: TaskAssistantWorkRefDto })
  workRef!: TaskAssistantWorkRefV1;
}

class TaskActionInputRefDto implements TaskActionInputRefV1 {
  @ApiProperty({
    type: String,
    enum: ["container", "node_task", "work_order"],
  })
  kind!: TaskActionInputRefV1["kind"];

  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: Number, nullable: true, minimum: 0 })
  version!: number | null;
}

class TaskActionCandidateSourceDto implements TaskActionCandidateSourceV1 {
  @ApiProperty({ type: String, enum: ["rule", "model", "fallback"] })
  kind!: TaskActionCandidateSourceV1["kind"];

  @ApiProperty({ type: String, enum: ["task.claim-assistance"] })
  capabilityId!: "task.claim-assistance";

  @ApiProperty({ type: Number, enum: [1] })
  capabilityVersion!: 1;

  @ApiProperty({ type: Number, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ type: String, nullable: true })
  promptVersion!: string | null;

  @ApiProperty({ type: String, nullable: true })
  modelId!: string | null;

  @ApiProperty({ type: String, pattern: "^[a-f0-9]{64}$" })
  inputSnapshotHash!: string;

  @ApiProperty({ type: [TaskActionInputRefDto] })
  inputRefs!: TaskActionCandidateSourceV1["inputRefs"];

  @ApiProperty({ type: String, format: "date-time" })
  generatedAt!: string;
}

class TaskActionResultRefDto implements TaskActionResultRefV1 {
  @ApiProperty({
    type: String,
    enum: ["container", "node_task", "work_order", "client_operation"],
  })
  kind!: TaskActionResultRefV1["kind"];

  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: Number, nullable: true, minimum: 0 })
  version!: number | null;
}

export class GenerateTaskActionCandidateRequestDto implements GenerateTaskActionCandidateCommandV1 {
  @ApiProperty({
    type: String,
    enum: ["task-action-candidate-generate.v1"],
  })
  contractVersion!: "task-action-candidate-generate.v1";

  @ApiProperty({ type: TaskAssistantSubjectRefDto })
  subjectRef!: TaskAssistantSubjectRefV1;

  @ApiProperty({ type: TaskAssistantWorkRefDto })
  workRef!: TaskAssistantWorkRefV1;
}

export class ConfirmTaskActionCandidateRequestDto implements ConfirmTaskActionCandidateCommandV1 {
  @ApiProperty({
    type: String,
    enum: ["task-action-candidate-confirm.v1"],
  })
  contractVersion!: "task-action-candidate-confirm.v1";

  @ApiProperty({ type: String, format: "uuid" })
  candidateId!: string;

  @ApiProperty({ type: String, pattern: "^[a-f0-9]{64}$" })
  candidateHash!: string;

  @ApiProperty({ type: String, maxLength: 200 })
  idempotencyKey!: string;
}

export class RejectTaskActionCandidateRequestDto implements RejectTaskActionCandidateCommandV1 {
  @ApiProperty({
    type: String,
    enum: ["task-action-candidate-reject.v1"],
  })
  contractVersion!: "task-action-candidate-reject.v1";

  @ApiProperty({ type: String, format: "uuid" })
  candidateId!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  reason?: string;
}

export class TaskActionCandidateResponseDto implements TaskActionCandidateV1 {
  @ApiProperty({ type: String, format: "uuid" })
  candidateId!: string;

  @ApiProperty({ type: String, pattern: "^[a-f0-9]{64}$" })
  candidateHash!: string;

  @ApiProperty({ type: TaskAssistantContextRefDto })
  context!: TaskAssistantContextRefV1;

  @ApiProperty({ type: String, format: "uuid" })
  workOrderId!: string;

  @ApiProperty({ type: String, enum: ["work_execution.claim_work_order"] })
  actionCode!: "work_execution.claim_work_order";

  @ApiProperty({ type: Number, enum: [1] })
  actionVersion!: 1;

  @ApiProperty({ type: String, maxLength: 200 })
  title!: string;

  @ApiProperty({ type: String, maxLength: 4000 })
  rationale!: string;

  @ApiProperty({ type: String, maxLength: 4000 })
  impact!: string;

  @ApiProperty({ type: String, enum: ["low"] })
  riskLevel!: "low";

  @ApiProperty({ type: [String], maxItems: 20, uniqueItems: true })
  warningCodes!: TaskActionCandidateV1["warningCodes"];

  @ApiProperty({
    type: String,
    enum: ["proposed", "accepted", "rejected", "expired"],
  })
  status!: TaskActionCandidateV1["status"];

  @ApiProperty({ type: TaskActionCandidateSourceDto })
  source!: TaskActionCandidateSourceV1;
}

export class TaskActionDecisionResponseDto implements TaskActionDecisionV1 {
  @ApiProperty({ type: String, format: "uuid" })
  decisionId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  candidateId!: string;

  @ApiProperty({ type: String, maxLength: 128 })
  decidedByActorId!: string;

  @ApiProperty({ type: String, enum: ["accepted", "rejected"] })
  decision!: TaskActionDecisionV1["decision"];

  @ApiProperty({ type: String, nullable: true, maxLength: 500 })
  reason!: string | null;

  @ApiProperty({ type: String, maxLength: 200 })
  idempotencyKey!: string;

  @ApiProperty({ type: String, format: "date-time" })
  decidedAt!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 128 })
  clientOperationId!: string | null;

  @ApiProperty({ type: String, nullable: true, maxLength: 128 })
  traceId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ["pending", "applied", "failed", null],
  })
  executionState!: TaskActionDecisionV1["executionState"];

  @ApiProperty({ type: [TaskActionResultRefDto], maxItems: 20 })
  resultRefs!: TaskActionDecisionV1["resultRefs"];
}

class TaskActionClaimWorkOrderResultDto implements TaskActionClaimWorkOrderResultV1 {
  @ApiProperty({ type: String, format: "uuid" })
  workOrderId!: string;

  @ApiProperty({
    type: String,
    enum: [
      "draft",
      "ready",
      "in_progress",
      "blocked",
      "completed",
      "failed",
      "reopened",
      "cancelled",
    ],
  })
  workOrderState!: TaskActionClaimWorkOrderResultV1["workOrderState"];

  @ApiProperty({
    type: String,
    enum: ["unassigned", "assigned", "pool", "automatic"],
  })
  assignmentState!: TaskActionClaimWorkOrderResultV1["assignmentState"];

  @ApiProperty({ type: String, nullable: true, maxLength: 128 })
  assigneeId!: string | null;

  @ApiProperty({ type: String, format: "uuid" })
  taskId!: string;

  @ApiProperty({
    type: String,
    enum: [
      "pending",
      "in_progress",
      "blocked",
      "completed",
      "reopened",
      "cancelled",
    ],
  })
  taskState!: TaskActionClaimWorkOrderResultV1["taskState"];

  @ApiProperty({ type: Boolean })
  applied!: boolean;

  @ApiProperty({ type: String, maxLength: 128 })
  clientOperationId!: string;

  @ApiProperty({
    type: String,
    enum: ["pending", "received", "duplicate", "boundary_rejected"],
  })
  receptionState!: TaskActionClaimWorkOrderResultV1["receptionState"];

  @ApiProperty({ type: String, enum: ["pending", "accepted", "rejected"] })
  businessDecisionState!: TaskActionClaimWorkOrderResultV1["businessDecisionState"];

  @ApiProperty({
    type: String,
    enum: ["pending", "committed", "commit_failed"],
  })
  commitState!: TaskActionClaimWorkOrderResultV1["commitState"];

  @ApiProperty({ type: String, nullable: true, maxLength: 100 })
  rejectionReasonCode!: string | null;
}

export class TaskActionConfirmResponseDto implements TaskActionConfirmResultV1 {
  @ApiProperty({
    type: String,
    enum: ["task-action-candidate-confirm-result.v1"],
  })
  contractVersion!: "task-action-candidate-confirm-result.v1";

  @ApiProperty({ type: TaskActionCandidateResponseDto })
  candidate!: TaskActionCandidateV1;

  @ApiProperty({ type: TaskActionDecisionResponseDto })
  decision!: TaskActionDecisionV1;

  @ApiProperty({ type: TaskActionClaimWorkOrderResultDto })
  claimWorkOrderResult!: TaskActionClaimWorkOrderResultV1;

  @ApiProperty({ type: Boolean })
  idempotencyReplay!: boolean;
}
