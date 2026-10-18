import { describe, expect, it, vi } from "vitest";
import type { WorkSessionV1 } from "@logix/contracts";
import {
  closeWorkSessionAndReload,
  hasLiveWorkSessionContext,
  switchWorkSession,
} from "./useWorkSessions";

const SOURCE = session("11111111-1111-4111-8111-111111111111", "current");
const TARGET = session("22222222-2222-4222-8222-222222222222", "resumable");

describe("switchWorkSession", () => {
  it("settles, validates, activates, navigates, then restores in order", async () => {
    const order: string[] = [];
    await switchWorkSession({
      source: SOURCE,
      target: TARGET,
      adapter: {
        settleBeforeLeave: vi.fn(async () => {
          order.push("settle-source");
          return { kind: "ready", sourceStatus: "resumable" } as const;
        }),
        validateTarget: vi.fn(async () => {
          order.push("validate-target");
          return { kind: "ready", domainVersionSeen: 0 } as const;
        }),
        restorePointer: vi.fn(async () => {
          order.push("restore-pointer");
        }),
      },
      activate: vi.fn(async () => {
        order.push("activate-server");
        return { ...TARGET, status: "current" as const };
      }),
      onActivated: vi.fn(() => {
        order.push("confirm-server-mutation");
      }),
      navigate: vi.fn(async () => {
        order.push("router-replace");
      }),
    });
    expect(order).toEqual([
      "settle-source",
      "validate-target",
      "activate-server",
      "confirm-server-mutation",
      "router-replace",
      "restore-pointer",
    ]);
  });

  it("reports navigation failure after activation as a confirmed server switch", async () => {
    const activated = { ...TARGET, status: "current" as const };
    const restorePointer = vi.fn();
    const result = await switchWorkSession({
      source: SOURCE,
      target: TARGET,
      adapter: readyAdapter(restorePointer),
      activate: vi.fn().mockResolvedValue(activated),
      onActivated: vi.fn(),
      navigate: vi.fn().mockRejectedValue(new Error("路由不可用")),
    });

    expect(result).toEqual({
      kind: "activated-local-failed",
      session: activated,
      stage: "navigate",
      message: "服务端已切换工作现场，但本页导航失败，请按当前工作现场重新进入",
    });
    expect(restorePointer).not.toHaveBeenCalled();
  });

  it("reports restore failure after activation and navigation as a confirmed server switch", async () => {
    const activated = { ...TARGET, status: "current" as const };
    const result = await switchWorkSession({
      source: SOURCE,
      target: TARGET,
      adapter: readyAdapter(
        vi.fn().mockRejectedValue(new Error("恢复指针失败")),
      ),
      activate: vi.fn().mockResolvedValue(activated),
      onActivated: vi.fn(),
      navigate: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      kind: "activated-local-failed",
      session: activated,
      stage: "restore",
      message: "服务端已切换工作现场，但本页恢复失败，请按当前工作现场重新进入",
    });
  });

  it("does not activate or navigate when target validation conflicts", async () => {
    const activate = vi.fn();
    const navigate = vi.fn();
    const result = await switchWorkSession({
      source: SOURCE,
      target: TARGET,
      adapter: {
        settleBeforeLeave: vi.fn(async () => ({
          kind: "ready" as const,
          sourceStatus: "resumable" as const,
        })),
        validateTarget: vi.fn(async () => ({
          kind: "conflict" as const,
          seenVersion: 3,
          latestVersion: 4,
          message: "目标版本已更新",
        })),
        restorePointer: vi.fn(),
      },
      activate,
      navigate,
    });
    expect(result).toMatchObject({
      kind: "conflict",
      seenVersion: 3,
      latestVersion: 4,
    });
    expect(activate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not activate or navigate when source settlement fails", async () => {
    const activate = vi.fn();
    const navigate = vi.fn();
    const result = await switchWorkSession({
      source: SOURCE,
      target: TARGET,
      adapter: {
        settleBeforeLeave: vi.fn(async () => ({
          kind: "failed" as const,
          message: "草稿没有保存",
        })),
        validateTarget: vi.fn(),
        restorePointer: vi.fn(),
      },
      activate,
      navigate,
    });
    expect(result).toEqual({ kind: "failed", message: "草稿没有保存" });
    expect(activate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("closeWorkSessionAndReload", () => {
  it("closes a non-current session and reloads the truthful server list", async () => {
    const closed = { ...TARGET, status: "closed" as const };
    const close = vi.fn().mockResolvedValue(closed);
    const applied: WorkSessionV1[] = [];
    const order: string[] = [];
    const reload = vi.fn(async () => {
      order.push("reload");
    });

    await expect(
      closeWorkSessionAndReload({
        session: TARGET,
        close: async (...args) => {
          order.push("close");
          return close(...args);
        },
        reload,
        onClosed: (session: WorkSessionV1) => {
          order.push("apply");
          applied.push(session);
        },
      }),
    ).resolves.toEqual({ kind: "closed", session: closed });

    expect(close).toHaveBeenCalledWith(TARGET.sessionId, {
      contractVersion: "work-session-close.v1",
      expectedVersion: TARGET.version,
    });
    expect(applied).toEqual([closed]);
    expect(order).toEqual(["close", "apply", "reload"]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reports a truthful closed result when the close succeeds but reload fails", async () => {
    const closed = { ...TARGET, status: "closed" as const };
    const applied: WorkSessionV1[] = [];

    const result = await closeWorkSessionAndReload({
      session: TARGET,
      close: vi.fn().mockResolvedValue(closed),
      reload: vi.fn().mockRejectedValue(new Error("列表暂时不可用")),
      onClosed: (session: WorkSessionV1) => applied.push(session),
    });

    expect(result).toEqual({
      kind: "closed",
      session: closed,
      message: "工作现场已关闭，但列表刷新失败，请重新加载",
    });
    expect(applied).toEqual([closed]);
  });

  it("keeps the current state and returns an actionable failure when close fails", async () => {
    const reload = vi.fn();
    const result = await closeWorkSessionAndReload({
      session: TARGET,
      close: vi.fn().mockRejectedValue(new Error("关闭冲突，请重新加载")),
      reload,
    });

    expect(result).toEqual({
      kind: "failed",
      message: "关闭冲突，请重新加载",
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("refuses to close the current session without calling the server", async () => {
    const close = vi.fn();
    const result = await closeWorkSessionAndReload({
      session: SOURCE,
      close,
      reload: vi.fn(),
    });

    expect(result).toEqual({
      kind: "failed",
      message: "当前工作现场不能关闭，请先切换到其他现场",
    });
    expect(close).not.toHaveBeenCalled();
  });

  it("refuses to close browser-held input and directs the user to its original tab", async () => {
    const close = vi.fn();
    const result = await closeWorkSessionAndReload({
      session: { ...TARGET, status: "browser_held" },
      close,
      reload: vi.fn(),
    });

    expect(result).toEqual({
      kind: "failed",
      message: "仅此标签保留的工作现场不能关闭，请回到原标签处理未保存输入",
    });
    expect(close).not.toHaveBeenCalled();
  });
});

describe("hasLiveWorkSessionContext", () => {
  it("ignores a closed copy so re-entering the same object can open a new controlled session", () => {
    expect(
      hasLiveWorkSessionContext(
        [{ ...TARGET, status: "closed" }],
        TARGET.contextKey,
      ),
    ).toBe(false);
    expect(hasLiveWorkSessionContext([TARGET], TARGET.contextKey)).toBe(true);
  });
});

function session(id: string, status: WorkSessionV1["status"]): WorkSessionV1 {
  return {
    contractVersion: "work-session.v1",
    sessionId: id,
    version: 1,
    status,
    workbenchCode: "product_selection",
    contextKey: "context",
    routeContext: {
      kind: "product_selection.v1",
      handoffId: "33333333-3333-4333-8333-333333333333",
    },
    subjectRef: {
      kind: "product_initiative_handoff",
      id: "33333333-3333-4333-8333-333333333333",
    },
    domainVersionSeen: 0,
    displaySummary: "选品",
    lastOpenedAt: "2026-10-14T08:00:00.000Z",
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
  };
}

function readyAdapter(restorePointer: ReturnType<typeof vi.fn>) {
  return {
    settleBeforeLeave: vi.fn(async () => ({
      kind: "ready" as const,
      sourceStatus: "resumable" as const,
    })),
    validateTarget: vi.fn(async () => ({
      kind: "ready" as const,
      domainVersionSeen: 0,
    })),
    restorePointer,
  };
}
