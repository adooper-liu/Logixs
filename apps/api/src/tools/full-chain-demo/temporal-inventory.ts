import { createHash } from "node:crypto";

export type TemporalWorkflow = {
  namespace: string;
  workflowId: string;
  runId?: string;
  type?: string;
  status?: string;
  input?: unknown;
  tenantId?: string;
  global?: boolean;
};
export type TemporalSchedule = { id: string; state?: string; global?: boolean };
export type TemporalInventoryResult = {
  entries: Array<Record<string, unknown>>;
  blockers: string[];
  targetCount: number;
};
type Temporal = {
  listWorkflows: () => Promise<TemporalWorkflow[]>;
  listSchedules: () => Promise<TemporalSchedule[]>;
};
function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

export async function collectTemporalInventory(input: {
  client: Temporal;
  targetTenant: string;
}): Promise<TemporalInventoryResult> {
  const blockers: string[] = [];
  const entries: Array<Record<string, unknown>> = [];
  for (const workflow of await input.client.listWorkflows()) {
    const attribution = workflow.global
      ? "global"
      : workflow.tenantId === input.targetTenant
        ? "target"
        : workflow.tenantId
          ? "other"
          : "ambiguous";
    if (attribution === "ambiguous")
      blockers.push("TEMPORAL_OWNERSHIP_AMBIGUOUS");
    if (workflow.input === undefined)
      blockers.push("TEMPORAL_INPUT_UNAVAILABLE");
    entries.push({
      namespace: workflow.namespace,
      workflowId: workflow.workflowId,
      runId: workflow.runId ?? null,
      type: workflow.type ?? null,
      status: workflow.status ?? null,
      attribution,
      inputFingerprint: fingerprint(workflow.input),
    });
  }
  for (const schedule of await input.client.listSchedules()) {
    const global =
      schedule.global || schedule.id === "outbox-publish-due-system";
    if (global) blockers.push("TEMPORAL_GLOBAL_SCHEDULE_BLOCKER");
    entries.push({
      kind: "schedule",
      scheduleId: schedule.id,
      state: schedule.state ?? "unknown",
      attribution: global ? "global" : "ambiguous",
      freezeRequired: global,
    });
  }
  return {
    entries,
    blockers: [...new Set(blockers)],
    targetCount: entries.filter((entry) => entry.attribution === "target")
      .length,
  };
}
