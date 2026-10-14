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
    const row = await this.repository.updatePointer({
      tenantId: input.tenantId,
      actorId: input.actorId,
      sessionId: input.sessionId,
      expectedVersion: input.command.expectedVersion,
      ...(input.command.status ? { status: input.command.status } : {}),
      ...(input.command.draftRef !== undefined
        ? { draftRef: input.command.draftRef }
        : {}),
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
  }
}
