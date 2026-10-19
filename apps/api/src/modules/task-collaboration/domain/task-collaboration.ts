import { createHash } from "node:crypto";
import type {
  CollaborationSourceRefV1,
  TaskCollaborationPostCommandV1,
} from "@logix/contracts";

export const TASK_COLLABORATION_VISIBILITY = "task_scope" as const;
export const TASK_COLLABORATION_BODY_MAX_LENGTH = 4_000;

export interface CollaborationPostCommandInput extends Omit<
  TaskCollaborationPostCommandV1,
  "mentionActorIds" | "evidenceRecordIds" | "sourceRefs"
> {
  mentionActorIds: readonly string[];
  evidenceRecordIds: readonly string[];
  sourceRefs: readonly CollaborationSourceRefV1[];
}

export interface NormalizedCollaborationPostCommand {
  contractVersion: "task-collaboration-post-command.v1";
  visibility: typeof TASK_COLLABORATION_VISIBILITY;
  subjectRef: TaskCollaborationPostCommandV1["subjectRef"];
  workRef: TaskCollaborationPostCommandV1["workRef"];
  body: string;
  parentMessageId: string | null;
  mentionActorIds: string[];
  evidenceRecordIds: string[];
  sourceRefs: Array<CollaborationSourceRefV1 & { version: number | null }>;
  idempotencyKey: string;
  payloadHash: string;
}

export interface CollaborationMessageIdentity {
  messageId: string;
  threadId: string;
}

export class CollaborationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollaborationValidationError";
  }
}

export function normalizeCollaborationPostCommand(
  input: CollaborationPostCommandInput,
): NormalizedCollaborationPostCommand {
  assertExactKeys(input, COMMAND_KEYS, "command");
  if (input.contractVersion !== "task-collaboration-post-command.v1") {
    invalid("VALIDATION_ENUM: contractVersion");
  }
  assertExactKeys(input.subjectRef, REFERENCE_KEYS, "subjectRef");
  if (input.subjectRef.kind !== "container") {
    invalid("VALIDATION_ENUM: subjectRef.kind");
  }
  assertExactKeys(input.workRef, REFERENCE_KEYS, "workRef");
  if (input.workRef.kind !== "node_task") {
    invalid("VALIDATION_ENUM: workRef.kind");
  }

  const normalizedWithoutHash = {
    contractVersion: "task-collaboration-post-command.v1" as const,
    visibility: TASK_COLLABORATION_VISIBILITY,
    subjectRef: {
      kind: "container" as const,
      id: uuid(input.subjectRef?.id, "subjectRef.id"),
    },
    workRef: {
      kind: "node_task" as const,
      id: uuid(input.workRef?.id, "workRef.id"),
    },
    body: body(input.body),
    parentMessageId:
      input.parentMessageId === null
        ? null
        : uuid(input.parentMessageId, "parentMessageId"),
    mentionActorIds: uniqueTexts(
      input.mentionActorIds,
      "mentionActorIds",
      20,
      128,
    ),
    evidenceRecordIds: uniqueUuids(
      input.evidenceRecordIds,
      "evidenceRecordIds",
      20,
    ),
    sourceRefs: normalizeSourceRefs(input.sourceRefs),
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
  };

  return {
    ...normalizedWithoutHash,
    payloadHash: createHash("sha256")
      .update(
        JSON.stringify({
          ...normalizedWithoutHash,
          idempotencyKey: undefined,
        }),
      )
      .digest("hex"),
  };
}

export function assertReplyParentInThread(
  threadId: string,
  parentMessageId: string | null,
  parent: CollaborationMessageIdentity | null,
): void {
  if (parentMessageId === null) {
    if (parent !== null) invalid("PARENT_UNEXPECTED");
    return;
  }
  if (!parent || parent.messageId !== parentMessageId) {
    invalid("PARENT_NOT_FOUND");
  }
  if (parent.threadId !== threadId) invalid("PARENT_THREAD_MISMATCH");
}

export function appendCollaborationMessage<
  T extends CollaborationMessageIdentity,
>(existing: readonly T[], message: T): readonly T[] {
  if (existing.some(({ messageId }) => messageId === message.messageId)) {
    invalid("MESSAGE_ALREADY_EXISTS");
  }
  if (existing.some(({ threadId }) => threadId !== message.threadId)) {
    invalid("MESSAGE_THREAD_MISMATCH");
  }
  return Object.freeze([...existing, Object.freeze({ ...message }) as T]);
}

function body(value: unknown): string {
  const normalized = text(value, "body", TASK_COLLABORATION_BODY_MAX_LENGTH);
  if (!/\S/u.test(normalized)) invalid("VALIDATION_FORMAT: body");
  return normalized;
}

function normalizeSourceRefs(
  refs: readonly CollaborationSourceRefV1[],
): Array<CollaborationSourceRefV1 & { version: number | null }> {
  if (!Array.isArray(refs)) {
    invalid("VALIDATION_RANGE: sourceRefs");
  }
  if (refs.length > 0) invalid("SOURCE_REFS_NOT_SUPPORTED");
  return [];
}

export function isTaskCollaborationPostable(state: string): boolean {
  return state === "pending" || state === "in_progress";
}

function uniqueTexts(
  values: readonly string[],
  field: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(values) || values.length > maxItems) {
    invalid(`VALIDATION_RANGE: ${field}`);
  }
  return [
    ...new Set(values.map((value) => text(value, field, maxLength))),
  ].sort();
}

function uniqueUuids(
  values: readonly string[],
  field: string,
  maxItems: number,
): string[] {
  if (!Array.isArray(values) || values.length > maxItems) {
    invalid(`VALIDATION_RANGE: ${field}`);
  }
  return [...new Set(values.map((value) => uuid(value, field)))].sort();
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(`VALIDATION_FORMAT: ${field}`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    invalid(`VALIDATION_RANGE: ${field}`);
  }
  return normalized;
}

function uuid(value: unknown, field: string): string {
  const normalized = text(value, field, 36).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) invalid(`VALIDATION_FORMAT: ${field}`);
  return normalized;
}

function assertExactKeys<T>(
  value: T,
  expectedKeys: ReadonlySet<string>,
  field: string,
  requiredKeys: ReadonlySet<string> = expectedKeys,
): asserts value is T & Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`VALIDATION_FORMAT: ${field}`);
  }
  for (const key of Object.keys(value)) {
    if (!expectedKeys.has(key)) invalid(`VALIDATION_FORBIDDEN: ${key}`);
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) invalid(`VALIDATION_REQUIRED: ${key}`);
  }
}

function invalid(message: string): never {
  throw new CollaborationValidationError(message);
}

const COMMAND_KEYS = new Set([
  "contractVersion",
  "subjectRef",
  "workRef",
  "body",
  "parentMessageId",
  "mentionActorIds",
  "evidenceRecordIds",
  "sourceRefs",
  "idempotencyKey",
]);
const REFERENCE_KEYS = new Set(["kind", "id"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
