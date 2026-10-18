import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, shallowRef } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WorkSessionRouteContextV1,
  WorkSessionV1,
} from "@logix/contracts";
import {
  activateWorkSession,
  closeWorkSession,
  listWorkSessions,
  openWorkSession,
  updateWorkSession,
} from "../api/workSessions";
import { useWorkbenchSessionSwitcher } from "./useWorkbenchSessionSwitcher";

vi.mock("../api/workSessions", () => ({
  activateWorkSession: vi.fn(),
  closeWorkSession: vi.fn(),
  listWorkSessions: vi.fn(),
  openWorkSession: vi.fn(),
  updateWorkSession: vi.fn(),
}));

class TestBroadcastChannel {
  static instances: TestBroadcastChannel[] = [];
  readonly listeners = new Set<(event: MessageEvent) => void>();

  constructor(readonly name: string) {
    TestBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  postMessage(): void {}
  close(): void {}

  emit(): void {
    for (const listener of this.listeners) {
      listener(new MessageEvent("message"));
    }
  }
}

describe("useWorkbenchSessionSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    TestBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  });

  it("restores the server pointer once during reconstruction but not on background refresh", async () => {
    const current = session("selection", "current", SELECTION_CONTEXT);
    vi.mocked(listWorkSessions).mockResolvedValue(sessionPage([current]));
    const restorePointer = vi.fn();
    const { wrapper } = mountSwitcher({ restorePointer });

    await flushPromises();
    expect(restorePointer).toHaveBeenCalledTimes(1);
    expect(restorePointer).toHaveBeenCalledWith(current);

    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    TestBroadcastChannel.instances[0]!.emit();
    await flushPromises();

    expect(listWorkSessions).toHaveBeenCalledTimes(4);
    expect(restorePointer).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("restores once when the reconstructed route context becomes available after mount", async () => {
    const current = session("selection", "current", SELECTION_CONTEXT);
    vi.mocked(listWorkSessions).mockResolvedValue(sessionPage([current]));
    const restorePointer = vi.fn();
    const { currentContext, wrapper } = mountSwitcher({
      currentContext: null,
      restorePointer,
    });

    await flushPromises();
    expect(restorePointer).not.toHaveBeenCalled();

    currentContext.value = {
      kind: "product_selection.v1",
      handoffId: "33333333-3333-4333-8333-333333333333",
    };
    await flushPromises();

    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(current);
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("keeps closed history when re-entering the same context", async () => {
    const otherCurrent = session("stuffing", "current", "other-context");
    const closed = session("closed-selection", "closed", SELECTION_CONTEXT);
    const reopened = session("new-selection", "resumable", SELECTION_CONTEXT);
    vi.mocked(listWorkSessions).mockResolvedValue(
      sessionPage([otherCurrent, closed]),
    );
    vi.mocked(openWorkSession).mockResolvedValue(reopened);
    const { result, wrapper } = mountSwitcher();

    await flushPromises();

    expect(result.sessions.value).toEqual([reopened, otherCurrent, closed]);
    expect(
      result.sessions.value.filter(({ status }) => status === "current"),
    ).toEqual([otherCurrent]);
    wrapper.unmount();
  });

  it("applies a successful close locally when the following list refresh fails", async () => {
    const current = session("selection", "current", SELECTION_CONTEXT);
    const target = session("stuffing", "resumable", "other-context");
    const closed = { ...target, status: "closed" as const, version: 2 };
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([current, target]))
      .mockRejectedValueOnce(new Error("列表暂时不可用"));
    vi.mocked(closeWorkSession).mockResolvedValue(closed);
    const { result, wrapper } = mountSwitcher();
    await flushPromises();

    await expect(result.close(target)).resolves.toEqual({
      kind: "closed",
      session: closed,
      message: "工作现场已关闭，但列表刷新失败，请重新加载",
    });
    expect(
      result.sessions.value.find(
        ({ sessionId }) => sessionId === target.sessionId,
      ),
    ).toEqual(closed);
    wrapper.unmount();
  });
});

const SELECTION_CONTEXT =
  "product_selection|product_initiative_handoff:33333333-3333-4333-8333-333333333333";

function mountSwitcher(
  overrides: {
    currentContext?: WorkSessionRouteContextV1 | null;
    restorePointer?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const currentContext = shallowRef<WorkSessionRouteContextV1 | null>(
    overrides.currentContext === undefined
      ? {
          kind: "product_selection.v1",
          handoffId: "33333333-3333-4333-8333-333333333333",
        }
      : overrides.currentContext,
  );
  let result!: ReturnType<typeof useWorkbenchSessionSwitcher>;
  const Host = defineComponent({
    setup() {
      result = useWorkbenchSessionSwitcher({
        router: {
          replace: vi.fn(),
          resolve: vi.fn(() => ({ href: "/target" })),
        },
        currentContext,
        currentSubjectRef: shallowRef({
          kind: "product_initiative_handoff" as const,
          id: "33333333-3333-4333-8333-333333333333",
        }),
        displaySummary: shallowRef("选品"),
        domainVersionSeen: shallowRef(0),
        activeItemKey: shallowRef("local-pointer"),
        contextMode: shallowRef("detail"),
        adapter: {
          settleBeforeLeave: vi.fn(async () => ({
            kind: "ready" as const,
            sourceStatus: "resumable" as const,
          })),
          validateTarget: vi.fn(async () => ({
            kind: "ready" as const,
            domainVersionSeen: 0,
          })),
          restorePointer: overrides.restorePointer ?? vi.fn(),
          discardLocal: vi.fn(),
        },
      });
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { currentContext, result, wrapper };
}

function session(
  id: string,
  status: WorkSessionV1["status"],
  contextKey: string,
): WorkSessionV1 {
  return {
    contractVersion: "work-session.v1",
    sessionId: id,
    version: 1,
    status,
    workbenchCode: "product_selection",
    contextKey,
    routeContext: {
      kind: "product_selection.v1",
      handoffId: "33333333-3333-4333-8333-333333333333",
    },
    subjectRef: {
      kind: "product_initiative_handoff",
      id: "33333333-3333-4333-8333-333333333333",
    },
    domainVersionSeen: 0,
    activeItemKey: "objective",
    contextMode: "context",
    displaySummary: id,
    lastOpenedAt: "2026-10-14T08:00:00.000Z",
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
  };
}

function sessionPage(items: WorkSessionV1[]) {
  return {
    contractVersion: "work-session-page.v1" as const,
    items,
    pageSize: 50,
    nextCursor: null,
  };
}

void activateWorkSession;
void updateWorkSession;
