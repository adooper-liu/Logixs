import type {
  ExternalWorkItemPriority,
  ExternalWorkItemState,
  NormalizedExternalWorkItemProjection,
} from "./external-work-item";

export const EXTERNAL_WORK_ITEM_REPOSITORY = Symbol(
  "ExternalWorkItemRepository",
);

export class ExternalWorkItemConflictError extends Error {}

export interface ExternalWorkItemRecord {
  id: string;
  tenantId: string;
  sourceModule: string;
  sourceType: string;
  sourceScopeId: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceItemKey: string;
  containerId: string;
  taskDefinitionKey: string;
  title: string;
  detail: string;
  priority: ExternalWorkItemPriority;
  state: ExternalWorkItemState;
  assignedRoleCode: string;
  evidenceRefs: string[];
  dueAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalWorkItemRepository {
  replaceProjection(input: NormalizedExternalWorkItemProjection): Promise<{
    items: ExternalWorkItemRecord[];
    created: number;
    cancelled: number;
    duplicate: boolean;
  }>;
  listOpen(input: {
    tenantId: string;
    containerId?: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ExternalWorkItemRecord[]>;
}
