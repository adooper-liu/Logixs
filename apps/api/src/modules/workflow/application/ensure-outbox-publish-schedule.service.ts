import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_TASK_QUEUE,
  OUTBOX_PUBLISH_DUE_WORKFLOW,
  outboxPublishDueScheduleId,
  parseScheduleIntervalSeconds,
  type OutboxPublishDueWorkflowArgs,
} from "../domain/outbox-publish-schedule";
import {
  WORKFLOW_SCHEDULE,
  type WorkflowSchedulePort,
} from "../domain/workflow-schedule.port";

export interface EnsureOutboxPublishScheduleInput {
  tenantId: string;
  operatorId: string;
  intervalSeconds?: number | string;
  limit?: number;
  maxRounds?: number;
}

export interface EnsureOutboxPublishScheduleResult {
  scheduleId: string;
  workflowType: string;
  intervalSeconds: number;
  created: boolean;
}

@Injectable()
export class EnsureOutboxPublishScheduleService {
  constructor(
    @Inject(WORKFLOW_SCHEDULE)
    private readonly schedules: WorkflowSchedulePort,
  ) {}

  async execute(
    input: EnsureOutboxPublishScheduleInput,
  ): Promise<EnsureOutboxPublishScheduleResult> {
    if (!input.tenantId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    if (!input.operatorId.trim()) {
      throw new HttpException(
        "AUTHENTICATION_REQUIRED",
        HttpStatus.UNAUTHORIZED,
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

    const args: OutboxPublishDueWorkflowArgs = {
      tenantId: input.tenantId.trim(),
      operatorId: input.operatorId.trim(),
    };
    if (input.limit !== undefined) args.limit = input.limit;
    if (input.maxRounds !== undefined) args.maxRounds = input.maxRounds;

    const scheduleId = outboxPublishDueScheduleId(args.tenantId);
    const ensured = await this.schedules.ensure({
      scheduleId,
      workflowType: OUTBOX_PUBLISH_DUE_WORKFLOW,
      taskQueue: BUSINESS_TASK_QUEUE,
      intervalSeconds,
      args: [args],
    });

    return {
      scheduleId,
      workflowType: OUTBOX_PUBLISH_DUE_WORKFLOW,
      intervalSeconds,
      created: ensured.created,
    };
  }
}
