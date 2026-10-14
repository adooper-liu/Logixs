import { Inject, Injectable } from "@nestjs/common";
import type {
  WorkSessionCloseCommandV1,
  WorkSessionV1,
} from "@logix/contracts";
import {
  WORK_SESSION_REPOSITORY,
  type WorkSessionRepository,
} from "../domain/work-session.repository";
import { toWorkSessionV1 } from "./open-work-session.service";

@Injectable()
export class CloseWorkSessionService {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly repository: WorkSessionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
    command: WorkSessionCloseCommandV1;
  }): Promise<WorkSessionV1> {
    return toWorkSessionV1(
      await this.repository.close({
        tenantId: input.tenantId,
        actorId: input.actorId,
        sessionId: input.sessionId,
        expectedVersion: input.command.expectedVersion,
      }),
    );
  }
}
