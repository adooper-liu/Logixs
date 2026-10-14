import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { WorkSessionOpenCommandV1, WorkSessionV1 } from "@logix/contracts";
import { contextKeyOf } from "../domain/work-session";
import {
  WORK_SESSION_REPOSITORY,
  type WorkSessionRepository,
  type WorkSessionRecord,
} from "../domain/work-session.repository";

@Injectable()
export class OpenWorkSessionService {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly repository: WorkSessionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    command: WorkSessionOpenCommandV1;
  }): Promise<WorkSessionV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (input.command.contractVersion !== "work-session-open.v1") {
      throw new Error("VALIDATION_FORMAT: contractVersion");
    }
    const result = await this.repository.openOrFocus({
      tenantId: input.tenantId,
      actorId: input.actorId,
      contextKey: contextKeyOf(input.command.routeContext),
      workbenchCode: input.command.workbenchCode,
      routeContext: input.command.routeContext,
      subjectRef: input.command.subjectRef,
      taskRef: input.command.taskRef ?? null,
      draftRef: input.command.draftRef ?? null,
      domainVersionSeen: input.command.domainVersionSeen ?? null,
      activeItemKey: input.command.activeItemKey ?? null,
      contextMode: input.command.contextMode ?? null,
      displaySummary: input.command.displaySummary,
    });
    return toWorkSessionV1(result.record);
  }
}

export function toWorkSessionV1(record: WorkSessionRecord): WorkSessionV1 {
  return {
    contractVersion: "work-session.v1",
    sessionId: record.sessionId,
    version: record.version,
    status: record.status,
    workbenchCode: record.workbenchCode,
    contextKey: record.contextKey,
    routeContext: record.routeContext,
    subjectRef: record.subjectRef,
    taskRef: record.taskRef,
    draftRef: record.draftRef,
    domainVersionSeen: record.domainVersionSeen,
    activeItemKey: record.activeItemKey,
    contextMode: record.contextMode,
    displaySummary: record.displaySummary,
    lastOpenedAt: record.lastOpenedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
