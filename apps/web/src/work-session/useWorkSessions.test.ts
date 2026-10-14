import { describe, expect, it, vi } from "vitest";
import type { WorkSessionV1 } from "@logix/contracts";
import { switchWorkSession } from "./useWorkSessions";

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
      navigate: vi.fn(async () => {
        order.push("router-replace");
      }),
    });
    expect(order).toEqual([
      "settle-source",
      "validate-target",
      "activate-server",
      "router-replace",
      "restore-pointer",
    ]);
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
