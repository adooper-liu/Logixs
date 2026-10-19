import { Injectable } from "@nestjs/common";
import type {
  LockedTaskCollaborationContext,
  TaskCollaborationWriteContextPort,
  TaskCollaborationWriteTransaction,
} from "../task-collaboration-write-context.port";

interface LockedTaskRow {
  id: string;
  tenantId: string;
  containerId: string | null;
  state: string;
}

interface LockedWorkOrderRow {
  id: string;
  assigneeId: string | null;
}

@Injectable()
export class PrismaTaskCollaborationWriteContext implements TaskCollaborationWriteContextPort {
  async lock(
    transaction: TaskCollaborationWriteTransaction,
    input: {
      tenantId: string;
      taskId: string;
      subjectRef: { kind: "container"; id: string };
    },
  ): Promise<LockedTaskCollaborationContext | null> {
    // Work-execution writes lock work orders before their parent task.
    await lockWorkOrders(transaction, input.taskId);
    const tasks = await transaction.$queryRaw<LockedTaskRow[]>`
      SELECT
        "id",
        "tenant_id" AS "tenantId",
        "container_id" AS "containerId",
        "state"
      FROM "node_task"
      WHERE "id" = ${input.taskId}
      FOR UPDATE
    `;
    const task = tasks[0];
    if (
      !task ||
      task.tenantId !== input.tenantId ||
      task.containerId !== input.subjectRef.id
    ) {
      return null;
    }

    // The task lock blocks new child inserts; re-read to include any insert that won the race.
    const workOrders = await lockWorkOrders(transaction, input.taskId);
    const assigneeActorIds = [
      ...new Set(
        workOrders
          .map(({ assigneeId }) => assigneeId?.trim() ?? "")
          .filter((actorId) => actorId.length > 0 && actorId.length <= 128),
      ),
    ].sort();
    return {
      taskId: task.id,
      state: task.state,
      containerId: task.containerId,
      assigneeActorIds,
    };
  }
}

function lockWorkOrders(
  transaction: TaskCollaborationWriteTransaction,
  taskId: string,
): Promise<LockedWorkOrderRow[]> {
  return transaction.$queryRaw<LockedWorkOrderRow[]>`
    SELECT "id", "assignee_id" AS "assigneeId"
    FROM "work_order"
    WHERE "node_task_id" = ${taskId}
    ORDER BY "id"
    FOR UPDATE
  `;
}
