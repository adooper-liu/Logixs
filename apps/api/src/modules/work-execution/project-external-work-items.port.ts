import type { ProjectExternalWorkItemsCommand } from "./domain/external-work-item";
import type { ExternalWorkItemRecord } from "./domain/external-work-item.repository";

export const PROJECT_EXTERNAL_WORK_ITEMS = Symbol.for(
  "logix.ProjectExternalWorkItems",
);

export interface ProjectExternalWorkItemsResult {
  items: ExternalWorkItemRecord[];
  created: number;
  cancelled: number;
  duplicate: boolean;
}

export interface ProjectExternalWorkItemsPort {
  execute(
    input: ProjectExternalWorkItemsCommand,
  ): Promise<ProjectExternalWorkItemsResult>;
}

export type {
  ExternalWorkItemDraft,
  ProjectExternalWorkItemsCommand,
} from "./domain/external-work-item";
