import { Inject, Injectable } from "@nestjs/common";
import type {
  WorkSessionUpdateCommandV1,
  WorkSessionV1,
} from "@logix/contracts";
import {
  WORK_SESSION_REPOSITORY,
  type WorkSessionRepository,
} from "../domain/work-session.repository";
import { toWorkSessionV1 } from "./open-work-session.service";
import { assertExactKeys } from "./work-session-request-validation";
import { throwWorkSessionHttpError } from "./work-session-errors";

@Injectable()
export class UpdateWorkSessionService {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly repository: WorkSessionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
    command: WorkSessionUpdateCommandV1;
  }): Promise<WorkSessionV1> {
    assertExactKeys(
      input.command,
      [
        "contractVersion",
        "expectedVersion",
        "status",
        "draftRef",
        "domainVersionSeen",
        "activeItemKey",
        "contextMode",
        "displaySummary",
      ],
      ["contractVersion", "expectedVersion"],
    );
    if (input.command.contractVersion !== "work-session-update.v1") {
      throw new Error("VALIDATION_FORMAT: contractVersion");
    }
    if (input.command.draftRef !== undefined) {
      throw new Error("WORK_SESSION_DRAFT_REF_SERVER_DERIVED");
    }
    if (
      !Number.isSafeInteger(input.command.expectedVersion) ||
      input.command.expectedVersion < 1
    ) {
      throw new Error("VALIDATION_FORMAT: expectedVersion");
    }
    if (
      input.command.status !== undefined &&
      !["resumable", "browser_held", "conflict"].includes(input.command.status)
    ) {
      throw new Error("VALIDATION_FORMAT: status");
    }
    try {
      const row = await this.repository.updatePointer({
        tenantId: input.tenantId,
        actorId: input.actorId,
        sessionId: input.sessionId,
        expectedVersion: input.command.expectedVersion,
        ...(input.command.status ? { status: input.command.status } : {}),
        ...(input.command.domainVersionSeen !== undefined
          ? { domainVersionSeen: input.command.domainVersionSeen }
          : {}),
        ...(input.command.activeItemKey !== undefined
          ? { activeItemKey: input.command.activeItemKey }
          : {}),
        ...(input.command.contextMode !== undefined
          ? { contextMode: input.command.contextMode }
          : {}),
        ...(input.command.displaySummary !== undefined
          ? { displaySummary: input.command.displaySummary }
          : {}),
      });
      return toWorkSessionV1(row);
    } catch (error) {
      throwWorkSessionHttpError(error);
    }
  }
}
