import {
  BadRequestException,
  ForbiddenException,
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
  decodeCollaborationCursor,
  encodeCollaborationCursor,
  parseCollaborationPageSize,
  CollaborationCursorError,
} from "../domain/task-collaboration-cursor";
import {
  TASK_COLLABORATION_REPOSITORY,
  type CollaborationScope,
  type TaskCollaborationRepository,
} from "../domain/task-collaboration.repository";
import {
  actorRef,
  presentMessage,
  presentThread,
} from "./task-collaboration-presenter";

export interface ListTaskCollaborationInput {
  tenantId: string;
  actorId: string;
  capabilities: string[];
  taskId: string;
  subjectKind?: string;
  subjectId?: string;
  pageSize?: string;
  cursor?: string;
}

@Injectable()
export class ListTaskCollaborationService {
  constructor(
    @Inject(TASK_COLLABORATION_CONTEXT)
    private readonly context: TaskCollaborationContextPort,
    @Inject(TASK_COLLABORATION_EVIDENCE)
    private readonly evidence: TaskCollaborationEvidencePort,
    @Inject(TASK_COLLABORATION_REPOSITORY)
    private readonly repository: TaskCollaborationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ListTaskCollaborationInput) {
    requireCapabilities(input.capabilities, ["task.read"]);
    if (input.subjectKind !== "container" || !input.subjectId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    const scope = collaborationScope(input);
    let cursor:
      | ReturnType<typeof decodeCollaborationCursor>
      | {
          asOf: Date;
          after: undefined;
        };
    let pageSize: number;
    try {
      cursor = input.cursor
        ? decodeCollaborationCursor(input.cursor, scope)
        : { asOf: this.now(), after: undefined };
      pageSize = parseCollaborationPageSize(input.pageSize);
    } catch (error) {
      if (error instanceof CollaborationCursorError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }
    const task = await this.context.resolve({
      tenantId: input.tenantId,
      taskId: input.taskId,
      subjectRef: { kind: "container", id: input.subjectId },
    });
    if (!task) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const thread = await this.repository.findThread(scope);
    const rows = thread
      ? await this.repository.listMessages({
          threadId: thread.id,
          asOf: cursor.asOf,
          ...(cursor.after ? { after: cursor.after } : {}),
          take: pageSize + 1,
        })
      : [];
    const hasNextPage = rows.length > pageSize;
    const messages = rows.slice(0, pageSize);
    const last = messages.at(-1);
    const mentionOptions = actorIds(input.actorId, task.assigneeActorIds)
      .slice(0, 20)
      .map(actorRef);
    const canReadEvidence = input.capabilities.includes("evidence.read");
    const evidenceRecordIds = [
      ...new Set(messages.flatMap((message) => message.evidenceRecordIds)),
    ].sort();
    const [evidenceOptions, readableEvidence] = canReadEvidence
      ? await Promise.all([
          this.evidence.listOptions({
            tenantId: input.tenantId,
            subjectRef: { kind: "container", id: input.subjectId },
          }),
          evidenceRecordIds.length > 0
            ? this.evidence.filterReadable({
                tenantId: input.tenantId,
                subjectRef: { kind: "container", id: input.subjectId },
                evidenceRecordIds,
              })
            : Promise.resolve([]),
        ])
      : [[], []];
    const readableEvidenceRecordIds = new Set(
      readableEvidence.map(({ evidenceRecordId }) => evidenceRecordId),
    );
    const canPost =
      input.capabilities.includes("task.collaborate") &&
      task.state !== "completed";

    return {
      contractVersion: "task-collaboration-page.v1" as const,
      thread: thread ? presentThread(thread) : null,
      subjectRef: { kind: "container" as const, id: input.subjectId },
      workRef: { kind: "node_task" as const, id: input.taskId },
      visibility: "task_scope" as const,
      visibilityLabel: "任务范围",
      messages: messages.map((message) =>
        presentMessage(message, readableEvidenceRecordIds),
      ),
      asOf: cursor.asOf.toISOString(),
      pageSize,
      nextCursor:
        hasNextPage && last
          ? encodeCollaborationCursor(scope, cursor.asOf, last)
          : null,
      canPost,
      postDisabledReason: canPost
        ? null
        : task.state === "completed"
          ? "TASK_COMPLETED_READ_ONLY"
          : "AUTHORIZATION_FORBIDDEN",
      mentionOptions,
      evidenceOptions: evidenceOptions.map(({ evidenceRecordId, label }) => ({
        ref: { kind: "evidence_record" as const, id: evidenceRecordId },
        label,
      })),
    };
  }
}

export function requireCapabilities(
  granted: readonly string[],
  required: readonly string[],
): void {
  const set = new Set(granted);
  if (!required.every((capability) => set.has(capability))) {
    throw new ForbiddenException("AUTHORIZATION_FORBIDDEN");
  }
}

export function actorIds(
  actorId: string,
  assignees: readonly string[],
): string[] {
  const currentActor = actorId.trim();
  if (currentActor.length === 0 || currentActor.length > 128) {
    throw new ForbiddenException("AUTHORIZATION_FORBIDDEN");
  }
  const knownAssignees = [
    ...new Set(
      assignees
        .map((value) => value.trim())
        .filter(
          (value) =>
            value.length > 0 && value.length <= 128 && value !== currentActor,
        ),
    ),
  ].sort();
  return [currentActor, ...knownAssignees];
}

function collaborationScope(
  input: Pick<ListTaskCollaborationInput, "tenantId" | "taskId" | "subjectId">,
): CollaborationScope {
  return {
    tenantId: input.tenantId,
    subjectKind: "container",
    subjectId: input.subjectId!,
    workKind: "node_task",
    workId: input.taskId,
    visibilityScope: "task_scope",
  };
}

export { collaborationScope };
