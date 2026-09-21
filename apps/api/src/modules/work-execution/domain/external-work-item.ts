import { createHash } from "node:crypto";

export const EXTERNAL_WORK_ITEM_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type ExternalWorkItemPriority =
  (typeof EXTERNAL_WORK_ITEM_PRIORITIES)[number];
export type ExternalWorkItemState = "open" | "completed" | "cancelled";

export interface ExternalWorkItemDraft {
  sourceItemKey: string;
  taskDefinitionKey: string;
  title: string;
  detail: string;
  priority: ExternalWorkItemPriority;
  assignedRoleCode: string;
  evidenceRefs: string[];
  dueAt?: string | null;
}

export interface ProjectExternalWorkItemsCommand {
  tenantId: string;
  sourceModule: string;
  sourceType: string;
  sourceScopeId: string;
  sourceRecordId: string;
  sourceVersion: number;
  containerId: string;
  items: ExternalWorkItemDraft[];
}

export interface NormalizedExternalWorkItem extends Omit<
  ExternalWorkItemDraft,
  "dueAt"
> {
  dueAt: Date | null;
  payloadHash: string;
}

export interface NormalizedExternalWorkItemProjection extends Omit<
  ProjectExternalWorkItemsCommand,
  "items"
> {
  items: NormalizedExternalWorkItem[];
  projectionHash: string;
}

export class ExternalWorkItemValidationError extends Error {}

const MAX_ITEMS_PER_PROJECTION = 5000;

export function normalizeExternalWorkItemProjection(
  input: ProjectExternalWorkItemsCommand,
): NormalizedExternalWorkItemProjection {
  const common = {
    tenantId: text(input.tenantId, "tenantId", 128),
    sourceModule: text(input.sourceModule, "sourceModule", 80),
    sourceType: text(input.sourceType, "sourceType", 80),
    sourceScopeId: text(input.sourceScopeId, "sourceScopeId", 256),
    sourceRecordId: text(input.sourceRecordId, "sourceRecordId", 128),
    sourceVersion: positiveInteger(input.sourceVersion, "sourceVersion"),
    containerId: text(input.containerId, "containerId", 128),
  };
  if (
    !Array.isArray(input.items) ||
    input.items.length > MAX_ITEMS_PER_PROJECTION
  ) {
    throw new ExternalWorkItemValidationError("VALIDATION_RANGE: items");
  }
  const itemKeys = new Set<string>();
  const items = input.items.map((item) => {
    const sourceItemKey = text(item.sourceItemKey, "sourceItemKey", 512);
    if (itemKeys.has(sourceItemKey)) {
      throw new ExternalWorkItemValidationError(
        "VALIDATION_CONFLICT: sourceItemKey",
      );
    }
    itemKeys.add(sourceItemKey);
    if (!EXTERNAL_WORK_ITEM_PRIORITIES.includes(item.priority)) {
      throw new ExternalWorkItemValidationError("VALIDATION_ENUM: priority");
    }
    const normalized = {
      sourceItemKey,
      taskDefinitionKey: text(item.taskDefinitionKey, "taskDefinitionKey", 160),
      title: text(item.title, "title", 200),
      detail: text(item.detail, "detail", 2000),
      priority: item.priority,
      assignedRoleCode: text(item.assignedRoleCode, "assignedRoleCode", 80),
      evidenceRefs: uniqueTextList(item.evidenceRefs, "evidenceRefs", 256),
      dueAt: optionalDate(item.dueAt, "dueAt"),
    };
    return {
      ...normalized,
      payloadHash: createHash("sha256")
        .update(
          JSON.stringify({
            contractVersion: "external-work-item-v1",
            ...common,
            ...normalized,
            dueAt: normalized.dueAt?.toISOString() ?? null,
          }),
          "utf8",
        )
        .digest("hex"),
    };
  });
  const projectionHash = createHash("sha256")
    .update(
      JSON.stringify({
        contractVersion: "external-work-item-projection-v1",
        ...common,
        itemHashes: items.map((item) => item.payloadHash),
      }),
      "utf8",
    )
    .digest("hex");
  return { ...common, items, projectionHash };
}

function text(value: string, field: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim()
  ) {
    throw new ExternalWorkItemValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return value;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ExternalWorkItemValidationError(`VALIDATION_RANGE: ${field}`);
  }
  return value;
}

function uniqueTextList(
  values: string[],
  field: string,
  maxLength: number,
): string[] {
  if (!Array.isArray(values)) {
    throw new ExternalWorkItemValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return [
    ...new Set(values.map((value) => text(value, field, maxLength))),
  ].sort();
}

function optionalDate(
  value: string | null | undefined,
  field: string,
): Date | null {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || value !== date.toISOString()) {
    throw new ExternalWorkItemValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return date;
}
