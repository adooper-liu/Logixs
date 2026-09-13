import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { SERVICE_ACTOR_TYPE } from "../../identity";
import {
  BUSINESS_TASK_QUEUE,
  OUTBOX_PUBLISH_DUE_SYSTEM_WORKFLOW,
  outboxPublishDueSystemScheduleId,
  parseScheduleIntervalSeconds,
  type OutboxPublishDueSystemWorkflowArgs,
} from "../domain/outbox-publish-schedule";
import {
  WORKFLOW_SCHEDULE,
  type WorkflowSchedulePort,
} from "../domain/workflow-schedule.port";

export interface EnsureOutboxPublishSystemScheduleInput {
  actorType: string;
  actorId: string;
  intervalSeconds?: number | string;
  limit?: number;
  maxRounds?: number;
  maxTenants?: number;
}

export interface EnsureOutboxPublishSystemScheduleResult {
  scheduleId: string;
  workflowType: string;
  intervalSeconds: number;
  created: boolean;
}

@Injectable()
export class EnsureOutboxPublishSystemScheduleService {
  constructor(
    @Inject(WORKFLOW_SCHEDULE)
    private readonly schedules: WorkflowSchedulePort,
  ) {}

  async execute(
    input: EnsureOutboxPublishSystemScheduleInput,
  ): Promise<EnsureOutboxPublishSystemScheduleResult> {
    if (input.actorType !== SERVICE_ACTOR_TYPE || !input.actorId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 需要服务身份",
        HttpStatus.FORBIDDEN,
      );
    }

    let intervalSeconds: number;
    try {
      intervalSeconds = parseScheduleIntervalSeconds(input.intervalSeconds);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const args: OutboxPublishDueSystemWorkflowArgs = {};
    if (input.limit !== undefined) args.limit = input.limit;
    if (input.maxRounds !== undefined) args.maxRounds = input.maxRounds;
    if (input.maxTenants !== undefined) args.maxTenants = input.maxTenants;

    const scheduleId = outboxPublishDueSystemScheduleId();
    const ensured = await this.schedules.ensure({
      scheduleId,
      workflowType: OUTBOX_PUBLISH_DUE_SYSTEM_WORKFLOW,
      taskQueue: BUSINESS_TASK_QUEUE,
      intervalSeconds,
      args: [args],
    });

    return {
      scheduleId,
      workflowType: OUTBOX_PUBLISH_DUE_SYSTEM_WORKFLOW,
      intervalSeconds,
      created: ensured.created,
    };
  }
}
