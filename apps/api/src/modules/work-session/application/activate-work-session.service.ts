import { Inject, Injectable } from "@nestjs/common";
import type {
  WorkSessionActivateCommandV1,
  WorkSessionV1,
} from "@logix/contracts";
import {
  WORK_SESSION_REPOSITORY,
  type WorkSessionRepository,
} from "../domain/work-session.repository";
import { toWorkSessionV1 } from "./open-work-session.service";
import { throwWorkSessionHttpError } from "./work-session-errors";

@Injectable()
export class ActivateWorkSessionService {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly repository: WorkSessionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    targetSessionId: string;
    command: WorkSessionActivateCommandV1;
  }): Promise<WorkSessionV1> {
    try {
      const result = await this.repository.activate({
        tenantId: input.tenantId,
        actorId: input.actorId,
        targetSessionId: input.targetSessionId,
        sourceSessionId: input.command.sourceSessionId,
        expectedSourceVersion: input.command.expectedSourceSessionVersion,
        expectedTargetVersion: input.command.expectedTargetSessionVersion,
        sourceStatus: input.command.sourceStatus,
        targetDomainVersionSeen: input.command.domainVersionSeen,
      });
      return toWorkSessionV1(result.target);
    } catch (error) {
      throwWorkSessionHttpError(error);
    }
  }
}
