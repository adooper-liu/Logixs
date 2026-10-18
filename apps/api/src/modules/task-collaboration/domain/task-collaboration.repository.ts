import type { NormalizedCollaborationPostCommand } from "./task-collaboration";

export const TASK_COLLABORATION_REPOSITORY = Symbol(
  "TaskCollaborationRepository",
);

export interface CollaborationScope {
  tenantId: string;
  subjectKind: "container";
  subjectId: string;
  workKind: "node_task";
  workId: string;
  visibilityScope: "task_scope";
}

export interface CollaborationThreadRecord extends CollaborationScope {
  id: string;
  policyVersion: number;
  createdByActorId: string;
  createdAt: Date;
}

export interface CollaborationMessageRecord {
  id: string;
  threadId: string;
  authorActorId: string;
  parentMessageId: string | null;
  body: string;
  occurredAt: Date;
  recordedAt: Date;
  mentions: string[];
  evidenceRecordIds: string[];
  sourceRefs: Array<{
    kind: "action" | "result" | "evidence";
    id: string;
    version: number | null;
  }>;
}

export interface TaskCollaborationRepository {
  findThread(
    scope: CollaborationScope,
  ): Promise<CollaborationThreadRecord | null>;
  listMessages(input: {
    threadId: string;
    asOf: Date;
    after?: { recordedAt: Date; id: string };
    take: number;
  }): Promise<CollaborationMessageRecord[]>;
  appendMessage(input: {
    scope: CollaborationScope;
    tenantId: string;
    authorActorId: string;
    command: NormalizedCollaborationPostCommand;
    occurredAt: Date;
  }): Promise<{
    thread: CollaborationThreadRecord;
    message: CollaborationMessageRecord;
    idempotencyReplay: boolean;
  }>;
}

export class CollaborationIdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_CONFLICT");
  }
}

export class CollaborationParentNotFoundError extends Error {
  constructor() {
    super("RESOURCE_NOT_FOUND");
  }
}

export class CollaborationPersistenceConflictError extends Error {
  constructor() {
    super("CONCURRENCY_VERSION_CONFLICT");
  }
}
