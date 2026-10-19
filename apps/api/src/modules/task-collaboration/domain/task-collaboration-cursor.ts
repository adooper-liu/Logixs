import type { CollaborationScope } from "./task-collaboration.repository";

export class CollaborationCursorError extends Error {
  constructor(readonly code: "CURSOR_INVALID" | "VALIDATION_RANGE: pageSize") {
    super(code);
  }
}

interface CursorPayload {
  v: 1;
  tenantId: string;
  subjectKind: "container";
  subjectId: string;
  workKind: "node_task";
  workId: string;
  visibilityScope: "task_scope";
  asOf: string;
  recordedAt: string;
  id: string;
}

export function encodeCollaborationCursor(
  scope: CollaborationScope,
  asOf: Date,
  last: { recordedAt: Date; id: string },
): string {
  const payload: CursorPayload = {
    v: 1,
    ...scope,
    asOf: asOf.toISOString(),
    recordedAt: last.recordedAt.toISOString(),
    id: last.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCollaborationCursor(
  value: string,
  expected: CollaborationScope,
): { asOf: Date; after: { recordedAt: Date; id: string } } {
  try {
    if (!value || value.length > 500) invalid();
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<CursorPayload>;
    const keys = Object.keys(parsed).sort();
    if (keys.join("|") !== CURSOR_KEYS) invalid();
    if (
      parsed.v !== 1 ||
      parsed.tenantId !== expected.tenantId ||
      parsed.subjectKind !== expected.subjectKind ||
      parsed.subjectId !== expected.subjectId ||
      parsed.workKind !== expected.workKind ||
      parsed.workId !== expected.workId ||
      parsed.visibilityScope !== expected.visibilityScope ||
      typeof parsed.asOf !== "string" ||
      typeof parsed.recordedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      invalid();
    }
    const asOf = date(parsed.asOf);
    const recordedAt = date(parsed.recordedAt);
    if (recordedAt > asOf) invalid();
    return { asOf, after: { recordedAt, id: parsed.id } };
  } catch (error) {
    if (error instanceof CollaborationCursorError) throw error;
    invalid();
  }
}

export function parseCollaborationPageSize(value?: string): number {
  if (value === undefined) return 20;
  if (!/^[1-9]\d*$/.test(value)) invalidPageSize();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 100) invalidPageSize();
  return parsed;
}

function date(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    invalid();
  }
  return parsed;
}

function invalid(): never {
  throw new CollaborationCursorError("CURSOR_INVALID");
}

function invalidPageSize(): never {
  throw new CollaborationCursorError("VALIDATION_RANGE: pageSize");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CURSOR_KEYS = [
  "asOf",
  "id",
  "recordedAt",
  "subjectId",
  "subjectKind",
  "tenantId",
  "v",
  "visibilityScope",
  "workId",
  "workKind",
]
  .sort()
  .join("|");
