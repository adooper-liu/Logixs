import type {
  WorkSessionDraftRefV1,
  WorkSessionRouteContextV1,
  WorkSessionStatusV1,
  WorkSessionSubjectRefV1,
  WorkSessionTaskRefV1,
} from "@logix/contracts";

export const WORK_SESSION_REPOSITORY = Symbol("WorkSessionRepository");

export interface WorkSessionRecord {
  sessionId: string;
  version: number;
  status: WorkSessionStatusV1;
  workbenchCode: "product_selection" | "stuffing";
  contextKey: string;
  routeContext: WorkSessionRouteContextV1;
  subjectRef: WorkSessionSubjectRefV1;
  taskRef: WorkSessionTaskRefV1 | null;
  draftRef: WorkSessionDraftRefV1 | null;
  domainVersionSeen: number | null;
  activeItemKey: string | null;
  contextMode: string | null;
  displaySummary: string;
  lastOpenedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkSessionRepository {
  list(input: {
    tenantId: string;
    actorId: string;
    after?: { lastOpenedAt: Date; id: string };
    take: number;
  }): Promise<WorkSessionRecord[]>;
  findById(
    tenantId: string,
    actorId: string,
    sessionId: string,
  ): Promise<WorkSessionRecord | null>;
  openOrFocus(input: {
    tenantId: string;
    actorId: string;
    contextKey: string;
    workbenchCode: WorkSessionRecord["workbenchCode"];
    routeContext: WorkSessionRouteContextV1;
    subjectRef: WorkSessionSubjectRefV1;
    taskRef: WorkSessionTaskRefV1 | null;
    draftRef: WorkSessionDraftRefV1 | null;
    domainVersionSeen: number | null;
    activeItemKey: string | null;
    contextMode: string | null;
    displaySummary: string;
  }): Promise<{ record: WorkSessionRecord; created: boolean }>;
  updatePointer(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
    expectedVersion: number;
    status?: Exclude<WorkSessionStatusV1, "current" | "closed">;
    draftRef?: WorkSessionDraftRefV1 | null;
    domainVersionSeen?: number | null;
    activeItemKey?: string | null;
    contextMode?: string | null;
    displaySummary?: string;
  }): Promise<WorkSessionRecord>;
  activate(input: {
    tenantId: string;
    actorId: string;
    targetSessionId: string;
    sourceSessionId: string;
    expectedSourceVersion: number;
    expectedTargetVersion: number;
    sourceStatus: Exclude<WorkSessionStatusV1, "current" | "closed">;
    sourceDomainVersionSeen: number | null;
    sourceActiveItemKey: string | null;
    sourceContextMode: string | null;
    targetDomainVersionSeen: number | null;
  }): Promise<{ source: WorkSessionRecord; target: WorkSessionRecord }>;
  close(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
    expectedVersion: number;
  }): Promise<WorkSessionRecord>;
}
