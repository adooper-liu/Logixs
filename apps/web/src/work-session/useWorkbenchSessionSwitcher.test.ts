import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, shallowRef, type ShallowRef } from "vue";
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
  readonly postedMessages: unknown[] = [];

  constructor(readonly name: string) {
    TestBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }
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

    expect(listWorkSessions).toHaveBeenCalledTimes(2);
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

  it("completes first-load recovery after mount fails and a background load succeeds", async () => {
    const current = session("selection", "current", SELECTION_CONTEXT);
    vi.mocked(listWorkSessions)
      .mockRejectedValueOnce(new Error("首次读取失败"))
      .mockResolvedValue(sessionPage([current]));
    const restorePointer = vi.fn();
    const { wrapper } = mountSwitcher({ restorePointer });

    await flushPromises();
    expect(restorePointer).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(current);

    document.dispatchEvent(new Event("visibilitychange"));
    TestBroadcastChannel.instances[0]!.emit();
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("shares the authoritative in-flight load within one mutation epoch", async () => {
    const current = session("selection", "current", SELECTION_CONTEXT);
    const firstLoad = deferred<ReturnType<typeof sessionPage>>();
    vi.mocked(listWorkSessions)
      .mockImplementationOnce(() => firstLoad.promise)
      .mockRejectedValueOnce(new Error("较新的并发读取失败"));
    const restorePointer = vi.fn();
    const { result, wrapper } = mountSwitcher({ restorePointer });

    const concurrentLoad = result.load();
    await flushPromises();
    expect(result.loading.value).toBe(true);
    firstLoad.resolve(sessionPage([current]));

    await expect(concurrentLoad).resolves.toBe(true);
    await flushPromises();
    expect(listWorkSessions).toHaveBeenCalledOnce();
    expect(result.sessions.value).toEqual([current]);
    expect(result.current.value).toEqual(current);
    expect(result.error.value).toBe("");
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(current);

    vi.mocked(listWorkSessions)
      .mockReset()
      .mockResolvedValue(sessionPage([current]));
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("restores the pointer once for each newly current route context", async () => {
    const contextB: WorkSessionRouteContextV1 = {
      kind: "product_selection.v1",
      handoffId: "44444444-4444-4444-8444-444444444444",
    };
    const contextKeyB =
      "product_selection|product_initiative_handoff:44444444-4444-4444-8444-444444444444";
    const currentA = session("selection-a", "current", SELECTION_CONTEXT);
    const currentB = {
      ...session("selection-b", "current", contextKeyB),
      routeContext: contextB,
      subjectRef: {
        kind: "product_initiative_handoff" as const,
        id: contextB.handoffId,
      },
    };
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([currentA]))
      .mockResolvedValue(sessionPage([currentB]));
    const restorePointer = vi.fn();
    const { currentContext, result, wrapper } = mountSwitcher({
      restorePointer,
    });

    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();

    await result.load();
    currentContext.value = contextB;
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledTimes(2);
    expect(restorePointer).toHaveBeenLastCalledWith(currentB);

    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledTimes(2);
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

  it("discards a pre-mutation load after the next epoch becomes authoritative", async () => {
    const current = session("selection", "current", SELECTION_CONTEXT);
    const target = session("stuffing", "resumable", "other-context");
    const closed = { ...target, status: "closed" as const, version: 2 };
    const staleList = deferred<ReturnType<typeof sessionPage>>();
    const postCloseList = deferred<ReturnType<typeof sessionPage>>();
    const postCloseListStarted = deferred<void>();
    vi.mocked(listWorkSessions)
      .mockImplementationOnce(() => staleList.promise)
      .mockImplementationOnce(() => {
        postCloseListStarted.resolve(undefined);
        return postCloseList.promise;
      });
    vi.mocked(closeWorkSession).mockResolvedValue(closed);
    const restorePointer = vi.fn();
    const { result, wrapper } = mountSwitcher({ restorePointer });

    const closeResult = result.close(target);
    await postCloseListStarted.promise;
    expect(listWorkSessions).toHaveBeenCalledTimes(2);

    postCloseList.resolve(sessionPage([current, closed]));
    await expect(closeResult).resolves.toMatchObject({
      kind: "closed",
      session: closed,
    });
    expect(result.current.value).toEqual(current);
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(current);

    staleList.resolve(
      sessionPage([
        { ...target, status: "current" },
        { ...current, status: "resumable" },
      ]),
    );
    await flushPromises();
    expect(
      result.sessions.value.find(
        ({ sessionId }) => sessionId === target.sessionId,
      ),
    ).toEqual(closed);
    expect(result.current.value).toEqual(current);
    expect(restorePointer).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("keeps the activated server truth when local navigation fails", async () => {
    const { source, target, activated } = switchSessions();
    const staleList = deferred<ReturnType<typeof sessionPage>>();
    const postMutationList = deferred<ReturnType<typeof sessionPage>>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => staleList.promise)
      .mockImplementationOnce(() => postMutationList.promise);
    vi.mocked(activateWorkSession).mockResolvedValue(activated);
    const replace = vi.fn().mockRejectedValue(new Error("路由不可用"));
    const restorePointer = vi.fn();
    const { result, wrapper } = mountSwitcher({
      currentContext: null,
      replace,
      restorePointer,
    });
    await flushPromises();

    const staleLoad = result.load();
    await flushPromises();
    const selection = result.select(target);
    await flushPromises();
    postMutationList.resolve(
      sessionPage([activated, { ...source, status: "resumable" }]),
    );
    const selectionResult = await selection;
    staleList.resolve(sessionPage([source, target]));
    await staleLoad;
    await flushPromises();

    expect(selectionResult).toEqual({
      kind: "activated-local-failed",
      session: activated,
      stage: "navigate",
      message: "服务端已切换工作现场，但本页导航失败，请按当前工作现场重新进入",
    });
    expect(result.current.value).toEqual(activated);
    expect(result.sessions.value).toEqual([
      activated,
      { ...source, status: "resumable" },
    ]);
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
    expect(restorePointer).not.toHaveBeenCalled();
    expect(listWorkSessions).toHaveBeenCalledTimes(3);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(1);
    wrapper.unmount();
  });

  it("keeps the activated server truth when local pointer restore fails", async () => {
    const { source, target, activated } = switchSessions();
    const staleList = deferred<ReturnType<typeof sessionPage>>();
    const postMutationList = deferred<ReturnType<typeof sessionPage>>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => staleList.promise)
      .mockImplementationOnce(() => postMutationList.promise);
    vi.mocked(activateWorkSession).mockResolvedValue(activated);
    const replace = vi.fn().mockResolvedValue(undefined);
    const restorePointer = vi.fn().mockRejectedValue(new Error("恢复指针失败"));
    const { result, wrapper } = mountSwitcher({
      currentContext: null,
      replace,
      restorePointer,
    });
    await flushPromises();

    const staleLoad = result.load();
    await flushPromises();
    const selection = result.select(target);
    await flushPromises();
    postMutationList.resolve(
      sessionPage([activated, { ...source, status: "resumable" }]),
    );
    const selectionResult = await selection;
    staleList.resolve(sessionPage([source, target]));
    await staleLoad;
    await flushPromises();

    expect(selectionResult).toEqual({
      kind: "activated-local-failed",
      session: activated,
      stage: "restore",
      message: "服务端已切换工作现场，但本页恢复失败，请按当前工作现场重新进入",
    });
    expect(result.current.value).toEqual(activated);
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(activated);
    expect(listWorkSessions).toHaveBeenCalledTimes(3);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(1);
    wrapper.unmount();
  });

  it("keeps the pre-mutation epoch authoritative when activation fails", async () => {
    const { source, target } = switchSessions();
    const staleList = deferred<ReturnType<typeof sessionPage>>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => staleList.promise);
    vi.mocked(activateWorkSession).mockRejectedValue(
      new Error("工作现场版本冲突"),
    );
    const replace = vi.fn();
    const restorePointer = vi.fn();
    const { result, wrapper } = mountSwitcher({
      currentContext: null,
      replace,
      restorePointer,
    });
    await flushPromises();

    const staleLoad = result.load();
    await flushPromises();
    const selectionResult = await result.select(target);
    staleList.resolve(sessionPage([source, target]));
    await staleLoad;
    await flushPromises();

    expect(selectionResult).toEqual({
      kind: "failed",
      message: "工作现场版本冲突",
    });
    expect(result.current.value).toEqual(source);
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(restorePointer).not.toHaveBeenCalled();
    expect(listWorkSessions).toHaveBeenCalledTimes(2);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(0);
    wrapper.unmount();
  });

  it("shares explicit restore ownership when the post-mutation list finishes before navigation", async () => {
    const { source, target, activated } = switchSessions();
    const staleList = deferred<ReturnType<typeof sessionPage>>();
    const postMutationList = deferred<ReturnType<typeof sessionPage>>();
    const navigation = deferred<void>();
    const restored = deferred<void>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => staleList.promise)
      .mockImplementationOnce(() => postMutationList.promise);
    vi.mocked(activateWorkSession).mockResolvedValue(activated);
    const routeContext = shallowRef<WorkSessionRouteContextV1 | null>(null);
    const replace = vi.fn(async () => {
      await navigation.promise;
      routeContext.value = target.routeContext;
    });
    const restorePointer = vi.fn(() => restored.promise);
    const mounted = mountSwitcher({
      currentContextRef: routeContext,
      replace,
      restorePointer,
    });
    const { result, wrapper } = mounted;
    await flushPromises();

    const staleLoad = result.load();
    await flushPromises();
    const selection = result.select(target);
    await flushPromises();
    postMutationList.resolve(
      sessionPage([activated, { ...source, status: "resumable" }]),
    );
    await flushPromises();
    expect(result.current.value).toEqual(activated);
    expect(restorePointer).not.toHaveBeenCalled();

    navigation.resolve(undefined);
    await flushPromises();
    restored.resolve(undefined);
    const selectionResult = await selection;
    staleList.resolve(sessionPage([source, target]));
    await staleLoad;
    await flushPromises();

    expect(selectionResult).toEqual({ kind: "switched", session: activated });
    expect(result.current.value).toEqual(activated);
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(activated);
    expect(listWorkSessions).toHaveBeenCalledTimes(3);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(1);
    wrapper.unmount();
  });

  it("restores once when navigation commits before the post-mutation list", async () => {
    const { source, target, activated } = switchSessions();
    const staleList = deferred<ReturnType<typeof sessionPage>>();
    const postMutationList = deferred<ReturnType<typeof sessionPage>>();
    const restored = deferred<void>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => staleList.promise)
      .mockImplementationOnce(() => postMutationList.promise);
    vi.mocked(activateWorkSession).mockResolvedValue(activated);
    const routeContext = shallowRef<WorkSessionRouteContextV1 | null>(null);
    const replace = vi.fn(async () => {
      routeContext.value = target.routeContext;
    });
    const restorePointer = vi.fn(() => restored.promise);
    const { result, wrapper } = mountSwitcher({
      currentContextRef: routeContext,
      replace,
      restorePointer,
    });
    await flushPromises();

    const staleLoad = result.load();
    await flushPromises();
    const selection = result.select(target);
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();
    restored.resolve(undefined);
    await flushPromises();
    postMutationList.resolve(
      sessionPage([activated, { ...source, status: "resumable" }]),
    );
    const selectionResult = await selection;
    staleList.resolve(sessionPage([source, target]));
    await staleLoad;
    await flushPromises();

    expect(selectionResult).toEqual({ kind: "switched", session: activated });
    expect(result.current.value).toEqual(activated);
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(activated);
    expect(listWorkSessions).toHaveBeenCalledTimes(3);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(1);
    wrapper.unmount();
  });

  it("clears failed restore ownership so an explicit re-entry can retry once", async () => {
    const { source, target, activated } = switchSessions();
    const postMutationList = deferred<ReturnType<typeof sessionPage>>();
    const navigation = deferred<void>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => postMutationList.promise)
      .mockResolvedValue(
        sessionPage([activated, { ...source, status: "resumable" }]),
      );
    vi.mocked(activateWorkSession).mockResolvedValue(activated);
    const routeContext = shallowRef<WorkSessionRouteContextV1 | null>(null);
    const replace = vi.fn(async () => {
      await navigation.promise;
      routeContext.value = target.routeContext;
    });
    const restorePointer = vi
      .fn()
      .mockRejectedValueOnce(new Error("恢复指针失败"))
      .mockResolvedValue(undefined);
    const { result, wrapper } = mountSwitcher({
      currentContextRef: routeContext,
      replace,
      restorePointer,
    });
    await flushPromises();

    const selection = result.select(target);
    await flushPromises();
    postMutationList.resolve(
      sessionPage([activated, { ...source, status: "resumable" }]),
    );
    await flushPromises();
    navigation.resolve(undefined);
    const selectionResult = await selection;
    await flushPromises();

    expect(selectionResult).toMatchObject({
      kind: "activated-local-failed",
      session: activated,
      stage: "restore",
    });
    expect(result.current.value).toEqual(activated);
    expect(restorePointer).toHaveBeenCalledOnce();

    routeContext.value = null;
    await flushPromises();
    routeContext.value = target.routeContext;
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledTimes(2);
    expect(restorePointer).toHaveBeenLastCalledWith(activated);

    await result.load();
    expect(restorePointer).toHaveBeenCalledTimes(2);
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(listWorkSessions).toHaveBeenCalledTimes(3);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(1);
    wrapper.unmount();
  });

  it("clears navigation-failure ownership so a later entry can restore", async () => {
    const { source, target, activated } = switchSessions();
    const postMutationList = deferred<ReturnType<typeof sessionPage>>();
    vi.mocked(listWorkSessions)
      .mockResolvedValueOnce(sessionPage([source, target]))
      .mockImplementationOnce(() => postMutationList.promise)
      .mockResolvedValue(
        sessionPage([activated, { ...source, status: "resumable" }]),
      );
    vi.mocked(activateWorkSession).mockResolvedValue(activated);
    const routeContext = shallowRef<WorkSessionRouteContextV1 | null>(null);
    const replace = vi.fn().mockRejectedValue(new Error("路由不可用"));
    const restorePointer = vi.fn().mockResolvedValue(undefined);
    const { result, wrapper } = mountSwitcher({
      currentContextRef: routeContext,
      replace,
      restorePointer,
    });
    await flushPromises();

    const selection = result.select(target);
    await flushPromises();
    postMutationList.resolve(
      sessionPage([activated, { ...source, status: "resumable" }]),
    );
    const selectionResult = await selection;

    expect(selectionResult).toMatchObject({
      kind: "activated-local-failed",
      session: activated,
      stage: "navigate",
    });
    expect(result.current.value).toEqual(activated);
    expect(restorePointer).not.toHaveBeenCalled();

    routeContext.value = target.routeContext;
    await flushPromises();
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(restorePointer).toHaveBeenCalledWith(activated);

    await result.load();
    expect(restorePointer).toHaveBeenCalledOnce();
    expect(activateWorkSession).toHaveBeenCalledOnce();
    expect(listWorkSessions).toHaveBeenCalledTimes(3);
    expect(TestBroadcastChannel.instances[0]!.postedMessages).toHaveLength(1);
    wrapper.unmount();
  });
});

const SELECTION_CONTEXT =
  "product_selection|product_initiative_handoff:33333333-3333-4333-8333-333333333333";

function mountSwitcher(
  overrides: {
    currentContext?: WorkSessionRouteContextV1 | null;
    currentContextRef?: ShallowRef<WorkSessionRouteContextV1 | null>;
    restorePointer?: ReturnType<typeof vi.fn>;
    replace?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const currentContext =
    overrides.currentContextRef ??
    shallowRef<WorkSessionRouteContextV1 | null>(
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
          replace: overrides.replace ?? vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function switchSessions() {
  const targetContext: WorkSessionRouteContextV1 = {
    kind: "product_selection.v1",
    handoffId: "44444444-4444-4444-8444-444444444444",
  };
  const source = session("selection", "current", SELECTION_CONTEXT);
  const target = {
    ...session(
      "selection-target",
      "resumable",
      "product_selection|product_initiative_handoff:44444444-4444-4444-8444-444444444444",
    ),
    routeContext: targetContext,
    subjectRef: {
      kind: "product_initiative_handoff" as const,
      id: targetContext.handoffId,
    },
  };
  return {
    source,
    target,
    activated: { ...target, status: "current" as const, version: 2 },
  };
}

void activateWorkSession;
void updateWorkSession;
