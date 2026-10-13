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
}
