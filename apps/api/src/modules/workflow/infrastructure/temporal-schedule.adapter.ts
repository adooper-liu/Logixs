import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Client } from "@temporalio/client";
import type {
  WorkflowSchedulePort,
  WorkflowScheduleSpec,
} from "../domain/workflow-schedule.port";

@Injectable()
export class TemporalScheduleAdapter
  implements WorkflowSchedulePort, OnModuleDestroy
{
  private readonly client = new Client({});

  async ensure(spec: WorkflowScheduleSpec): Promise<{ created: boolean }> {
    const payload = {
      spec: {
        intervals: [{ every: spec.intervalSeconds * 1000 }],
      },
      policies: {
        overlap: "SKIP" as const,
      },
      action: {
        type: "startWorkflow" as const,
        workflowType: spec.workflowType,
        taskQueue: spec.taskQueue,
        args: spec.args,
      },
    };

    try {
      await this.client.schedule.create({
        scheduleId: spec.scheduleId,
        ...payload,
      });
      return { created: true };
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const handle = this.client.schedule.getHandle(spec.scheduleId);
      await handle.update((previous) => ({
        ...payload,
        state: previous.state,
      }));
      return { created: false };
    }
  }

  onModuleDestroy(): void {
    this.client.connection.close();
  }
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ScheduleAlreadyRunningError" ||
      error.name === "ALREADY_EXISTS")
  );
}
