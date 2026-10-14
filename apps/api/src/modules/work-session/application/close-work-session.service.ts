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
import { assertExactKeys } from "./work-session-request-validation";
import { throwWorkSessionHttpError } from "./work-session-errors";

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
    assertExactKeys(
      input.command,
      ["contractVersion", "expectedVersion"],
      ["contractVersion", "expectedVersion"],
    );
    if (input.command.contractVersion !== "work-session-close.v1") {
      throw new Error("VALIDATION_FORMAT: contractVersion");
    }
    try {
      return toWorkSessionV1(
        await this.repository.close({
          tenantId: input.tenantId,
          actorId: input.actorId,
          sessionId: input.sessionId,
          expectedVersion: input.command.expectedVersion,
        }),
      );
    } catch (error) {
      throwWorkSessionHttpError(error);
    }
  }
}
