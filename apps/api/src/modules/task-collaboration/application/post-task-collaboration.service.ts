import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  TASK_COLLABORATION_EVIDENCE,
  type TaskCollaborationEvidencePort,
} from "../../document-records";
import {
  TASK_COLLABORATION_CONTEXT,
  type TaskCollaborationContextPort,
} from "../../work-execution";
import {
  CollaborationValidationError,
  type CollaborationPostCommandInput,
  normalizeCollaborationPostCommand,
} from "../domain/task-collaboration";
import {
  CollaborationIdempotencyConflictError,
  CollaborationParentNotFoundError,
  CollaborationPersistenceConflictError,
  TASK_COLLABORATION_REPOSITORY,
  type TaskCollaborationRepository,
} from "../domain/task-collaboration.repository";
import {
  actorIds,
  collaborationScope,
  requireCapabilities,
} from "./list-task-collaboration.service";
import { presentMessage } from "./task-collaboration-presenter";

export interface PostTaskCollaborationInput {
  tenantId: string;
  actorId: string;
  capabilities: string[];
  taskId: string;
  command: CollaborationPostCommandInput;
}

@Injectable()
export class PostTaskCollaborationService {
  constructor(
    @Inject(TASK_COLLABORATION_CONTEXT)
    private readonly context: TaskCollaborationContextPort,
    @Inject(TASK_COLLABORATION_EVIDENCE)
    private readonly evidence: TaskCollaborationEvidencePort,
    @Inject(TASK_COLLABORATION_REPOSITORY)
    private readonly repository: TaskCollaborationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: PostTaskCollaborationInput) {
    requireCapabilities(input.capabilities, ["task.read", "task.collaborate"]);
    let command;
    try {
      command = normalizeCollaborationPostCommand(input.command);
    } catch (error) {
      if (error instanceof CollaborationValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    if (command.evidenceRecordIds.length > 0) {
      requireCapabilities(input.capabilities, ["evidence.read"]);
    }
    if (command.workRef.id !== input.taskId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    const task = await this.context.resolve({
      tenantId: input.tenantId,
      taskId: input.taskId,
      subjectRef: command.subjectRef,
    });
    if (!task) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (task.state === "completed") {
      throw new ConflictException("BUSINESS_STATE_VIOLATION");
    }
    const normalizedActorId = actorIds(input.actorId, [])[0]!;
    const allowedActors = new Set(
      actorIds(normalizedActorId, task.assigneeActorIds),
    );
    if (command.mentionActorIds.some((id) => !allowedActors.has(id))) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    try {
      if (command.evidenceRecordIds.length > 0) {
        await this.evidence.resolveExact({
          tenantId: input.tenantId,
          subjectRef: command.subjectRef,
          evidenceRecordIds: command.evidenceRecordIds,
        });
      }
      const result = await this.repository.appendMessage({
        scope: collaborationScope({
          tenantId: input.tenantId,
          taskId: input.taskId,
          subjectId: command.subjectRef.id,
        }),
        tenantId: input.tenantId,
        authorActorId: normalizedActorId,
        command,
        occurredAt: this.now(),
      });
      return {
        contractVersion: "task-collaboration-post-result.v1" as const,
        message: presentMessage(
          result.message,
          new Set(command.evidenceRecordIds),
        ),
        idempotencyReplay: result.idempotencyReplay,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof CollaborationIdempotencyConflictError) {
        throw new ConflictException("IDEMPOTENCY_KEY_CONFLICT");
      }
      if (error instanceof CollaborationParentNotFoundError) {
        throw new NotFoundException("RESOURCE_NOT_FOUND");
      }
      if (error instanceof CollaborationPersistenceConflictError) {
        throw new ConflictException("CONCURRENCY_VERSION_CONFLICT");
      }
      throw error;
    }
  }
}
