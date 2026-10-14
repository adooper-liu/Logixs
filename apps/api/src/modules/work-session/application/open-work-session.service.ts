import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { WorkSessionOpenCommandV1, WorkSessionV1 } from "@logix/contracts";
import { contextKeyOf } from "../domain/work-session";
import {
  WORK_SESSION_REPOSITORY,
  type WorkSessionRepository,
  type WorkSessionRecord,
} from "../domain/work-session.repository";
import { assertExactKeys } from "./work-session-request-validation";

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
    assertExactKeys(
      input.command,
      [
        "contractVersion",
        "workbenchCode",
        "routeContext",
        "subjectRef",
        "taskRef",
        "draftRef",
        "domainVersionSeen",
        "activeItemKey",
        "contextMode",
        "displaySummary",
      ],
      [
        "contractVersion",
        "workbenchCode",
        "routeContext",
        "subjectRef",
        "displaySummary",
      ],
    );
    assertReferenceCoherence(input.command);
    if (input.command.draftRef !== undefined) {
      throw new Error("WORK_SESSION_DRAFT_REF_SERVER_DERIVED");
    }
    const result = await this.repository.openOrFocus({
      tenantId: input.tenantId,
      actorId: input.actorId,
      contextKey: contextKeyOf(input.command.routeContext),
      workbenchCode: input.command.workbenchCode,
      routeContext: input.command.routeContext,
      subjectRef: input.command.subjectRef,
      taskRef: input.command.taskRef ?? null,
      draftRef: null,
      domainVersionSeen: input.command.domainVersionSeen ?? null,
      activeItemKey: input.command.activeItemKey ?? null,
      contextMode: input.command.contextMode ?? null,
      displaySummary: input.command.displaySummary,
    });
    return toWorkSessionV1(result.record);
  }
}

function assertReferenceCoherence(command: WorkSessionOpenCommandV1): void {
  const context = command.routeContext;
  if (context.kind === "product_selection.v1") {
    if (
      command.workbenchCode !== "product_selection" ||
      command.subjectRef.kind !== "product_initiative_handoff" ||
      command.subjectRef.id !== context.handoffId ||
      command.taskRef
    ) {
      throw new Error("WORK_SESSION_REFERENCE_MISMATCH");
    }
    return;
  }
  if (
    command.workbenchCode !== "stuffing" ||
    command.subjectRef.kind !== "container" ||
    command.subjectRef.id !== context.containerId ||
    command.taskRef?.kind !== "node_task" ||
    command.taskRef.id !== context.taskId
  ) {
    throw new Error("WORK_SESSION_REFERENCE_MISMATCH");
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
