import type { WorkSessionV1 } from "@logix/contracts";
import type { WorkSessionSwitchAdapter } from "./workSessionAdapter";

export type SwitchWorkSessionResult =
  | { kind: "switched"; session: WorkSessionV1 }
  | { kind: "needs-choice"; choices: readonly string[] }
  | {
      kind: "conflict";
      seenVersion: number | null;
      latestVersion: number | null;
      message: string;
    }
  | { kind: "failed"; message: string };

export async function switchWorkSession(input: {
  source: WorkSessionV1;
  target: WorkSessionV1;
  adapter: WorkSessionSwitchAdapter;
  activate(args: {
    source: WorkSessionV1;
    target: WorkSessionV1;
    sourceStatus: Exclude<WorkSessionV1["status"], "current" | "closed">;
    domainVersionSeen: number | null;
  }): Promise<WorkSessionV1>;
  navigate(context: WorkSessionV1["routeContext"]): Promise<unknown>;
}): Promise<SwitchWorkSessionResult> {
  const settlement = await input.adapter.settleBeforeLeave("switch");
  if (settlement.kind !== "ready") return settlement;
  const validation = await input.adapter.validateTarget(input.target);
  if (validation.kind !== "ready") return validation;
  try {
    const activated = await input.activate({
      source: input.source,
      target: input.target,
      sourceStatus: settlement.sourceStatus,
      domainVersionSeen: validation.domainVersionSeen,
    });
    await input.navigate(input.target.routeContext);
    await input.adapter.restorePointer(activated);
    return { kind: "switched", session: activated };
  } catch (error) {
    return {
      kind: "failed",
      message: error instanceof Error ? error.message : "工作现场切换失败",
    };
  }
}
