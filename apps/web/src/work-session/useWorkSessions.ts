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

export type CloseWorkSessionResult =
  | { kind: "closed"; session: WorkSessionV1; message?: string }
  | { kind: "failed"; message: string };

export async function closeWorkSessionAndReload(input: {
  session: WorkSessionV1;
  close(
    sessionId: string,
    command: {
      contractVersion: "work-session-close.v1";
      expectedVersion: number;
    },
  ): Promise<WorkSessionV1>;
  reload(): Promise<void>;
  onClosed?(session: WorkSessionV1): void;
}): Promise<CloseWorkSessionResult> {
  if (input.session.status === "current") {
    return {
      kind: "failed",
      message: "当前工作现场不能关闭，请先切换到其他现场",
    };
  }
  if (input.session.status === "closed") {
    return { kind: "failed", message: "工作现场已经关闭" };
  }
  if (input.session.status === "browser_held") {
    return {
      kind: "failed",
      message: "仅此标签保留的工作现场不能关闭，请回到原标签处理未保存输入",
    };
  }
  let closed: WorkSessionV1;
  try {
    closed = await input.close(input.session.sessionId, {
      contractVersion: "work-session-close.v1",
      expectedVersion: input.session.version,
    });
  } catch (error) {
    return {
      kind: "failed",
      message: error instanceof Error ? error.message : "工作现场关闭失败",
    };
  }
  input.onClosed?.(closed);
  try {
    await input.reload();
  } catch {
    return {
      kind: "closed",
      session: closed,
      message: "工作现场已关闭，但列表刷新失败，请重新加载",
    };
  }
  return { kind: "closed", session: closed };
}

export function hasLiveWorkSessionContext(
  sessions: readonly WorkSessionV1[],
  contextKey: string,
): boolean {
  return sessions.some(
    (session) =>
      session.contextKey === contextKey && session.status !== "closed",
  );
}

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
