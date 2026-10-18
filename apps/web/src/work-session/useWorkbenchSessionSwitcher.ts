import {
  computed,
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  shallowRef,
  watch,
} from "vue";
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
import { toRouteLocation } from "./routeContext";
import {
  readActiveSessionId,
  writeActiveSessionId,
} from "./workSessionBrowserState";
import type {
  DirtyChoice,
  WorkSessionSwitchAdapter,
} from "./workSessionAdapter";
import {
  switchWorkSession,
  closeWorkSessionAndReload,
  hasLiveWorkSessionContext,
  type CloseWorkSessionResult,
  type SwitchWorkSessionResult,
} from "./useWorkSessions";

export function useWorkbenchSessionSwitcher(input: {
  router: {
    replace(location: unknown): Promise<unknown>;
    resolve(location: unknown): { href: string };
  };
  currentContext: Readonly<{ value: WorkSessionRouteContextV1 | null }>;
  currentSubjectRef: Readonly<{ value: WorkSessionV1["subjectRef"] | null }>;
  currentTaskRef?: Readonly<{ value: WorkSessionV1["taskRef"] | null }>;
  displaySummary: Readonly<{ value: string }>;
  domainVersionSeen: Readonly<{ value: number | null }>;
  activeItemKey?: Readonly<{ value: string | null }>;
  contextMode?: Readonly<{ value: string | null }>;
  adapter: WorkSessionSwitchAdapter & {
    discardLocal(): void;
  };
}) {
  const sessions = ref<WorkSessionV1[]>([]);
  const loading = shallowRef(false);
  const error = shallowRef("");
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("logix.work-sessions.v1");
  const restoredContextKeys = new Set<string>();
  const contextRecoveries = new Map<string, Promise<void>>();
  const explicitContextRecoveries = new Map<string, Promise<void>>();
  let mutationEpoch = 0;
  let authoritativeLoad: {
    epoch: number;
    restoreCurrent: boolean;
    promise?: Promise<boolean>;
  } | null = null;
  const refresh = () => void load();
  channel?.addEventListener("message", refresh);

  const current = computed(() => {
    const activeId = readActiveSessionId(window.sessionStorage);
    return (
      sessions.value.find((session) => session.sessionId === activeId) ??
      sessions.value.find((session) => session.status === "current") ??
      null
    );
  });

  function load(restoreCurrent = true): Promise<boolean> {
    const epoch = mutationEpoch;
    if (authoritativeLoad?.epoch === epoch && authoritativeLoad.promise) {
      return authoritativeLoad.promise;
    }
    const flight: NonNullable<typeof authoritativeLoad> = {
      epoch,
      restoreCurrent,
    };
    authoritativeLoad = flight;
    flight.promise = runLoad(flight);
    return flight.promise;
  }

  async function runLoad(
    flight: NonNullable<typeof authoritativeLoad>,
  ): Promise<boolean> {
    loading.value = true;
    error.value = "";
    try {
      const page = await listWorkSessions({ includeClosed: true });
      if (flight.epoch !== mutationEpoch) {
        return true;
      }
      sessions.value = page.items;
      const serverCurrent = page.items.find(
        (session) => session.status === "current",
      );
      writeActiveSessionId(
        window.sessionStorage,
        serverCurrent?.sessionId ?? null,
      );
      if (flight.restoreCurrent) await ensureAndRestoreCurrent();
      return true;
    } catch (caught) {
      if (authoritativeLoad === flight) {
        error.value =
          caught instanceof Error ? caught.message : "工作现场没有加载";
      }
      return false;
    } finally {
      if (authoritativeLoad === flight) {
        authoritativeLoad = null;
        loading.value = false;
      }
    }
  }

  async function initialize(): Promise<void> {
    await load();
  }

  async function ensureAndRestoreCurrent(): Promise<void> {
    const context = input.currentContext.value;
    if (!context) return;
    const key = contextKey(context);
    if (restoredContextKeys.has(key)) return;
    const explicitRecovery = explicitContextRecoveries.get(key);
    if (explicitRecovery) return explicitRecovery;
    const existing = contextRecoveries.get(key);
    if (existing) return existing;
    const recovery = (async () => {
      await ensureCurrent();
      const pageCurrent = sessions.value.find(
        (session) => session.contextKey === key && session.status === "current",
      );
      if (!pageCurrent) return;
      await input.adapter.restorePointer(pageCurrent);
      restoredContextKeys.add(key);
    })();
    contextRecoveries.set(key, recovery);
    try {
      await recovery;
    } finally {
      contextRecoveries.delete(key);
    }
  }

  async function ensureCurrent(): Promise<void> {
    const context = input.currentContext.value;
    const subjectRef = input.currentSubjectRef.value;
    if (!context || !subjectRef) return;
    const currentKey = contextKey(context);
    if (hasLiveWorkSessionContext(sessions.value, currentKey)) return;
    const opened = await openWorkSession({
      contractVersion: "work-session-open.v1",
      workbenchCode:
        context.kind === "product_selection.v1"
          ? "product_selection"
          : "stuffing",
      routeContext: context,
      subjectRef,
      taskRef: input.currentTaskRef?.value ?? null,
      domainVersionSeen: input.domainVersionSeen.value,
      activeItemKey: input.activeItemKey?.value ?? null,
      contextMode: input.contextMode?.value ?? null,
      displaySummary: input.displaySummary.value,
    });
    mutationEpoch += 1;
    sessions.value = [
      opened,
      ...sessions.value.filter(
        (session) =>
          session.sessionId !== opened.sessionId &&
          (session.contextKey !== opened.contextKey ||
            session.status === "closed"),
      ),
    ];
  }

  async function select(
    target: WorkSessionV1,
  ): Promise<SwitchWorkSessionResult> {
    const source = current.value;
    if (!source) return { kind: "failed", message: "当前工作现场尚未建立" };
    let postActivationLoad: Promise<boolean> | null = null;
    const explicitRecoveryOwner: { value: ExplicitRecoveryOwner | null } = {
      value: null,
    };
    try {
      const result = await switchWorkSession({
        source,
        target,
        adapter: input.adapter,
        activate: activate,
        onActivated: (activated) => {
          explicitRecoveryOwner.value = createExplicitRecoveryOwner(
            contextKey(activated.routeContext),
          );
          explicitContextRecoveries.set(
            explicitRecoveryOwner.value.key,
            explicitRecoveryOwner.value.promise,
          );
          mutationEpoch += 1;
          channel?.postMessage({ type: "work-session-changed" });
          postActivationLoad = load(false);
        },
        navigate: (context) => input.router.replace(toRouteLocation(context)),
      });
      if (result.kind === "conflict") {
        await updateWorkSession(target.sessionId, {
          contractVersion: "work-session-update.v1",
          expectedVersion: target.version,
          status: "conflict",
          domainVersionSeen: result.latestVersion,
        });
        mutationEpoch += 1;
        await load();
        return result;
      }
      if (result.kind === "switched") {
        restoredContextKeys.add(contextKey(result.session.routeContext));
      }
      if (
        result.kind === "switched" ||
        result.kind === "activated-local-failed"
      ) {
        await postActivationLoad;
      }
      return result;
    } finally {
      const owner = explicitRecoveryOwner.value;
      if (owner) {
        if (explicitContextRecoveries.get(owner.key) === owner.promise) {
          explicitContextRecoveries.delete(owner.key);
        }
        owner.release();
      }
    }
  }

  async function close(
    session: WorkSessionV1,
  ): Promise<CloseWorkSessionResult> {
    const result = await closeWorkSessionAndReload({
      session,
      close: closeWorkSession,
      onClosed: (closed) => {
        mutationEpoch += 1;
        sessions.value = sessions.value.map((item) =>
          item.sessionId === closed.sessionId ? closed : item,
        );
      },
      reload: async () => {
        if (!(await load())) throw new Error(error.value);
      },
    });
    if (result.kind === "closed") {
      channel?.postMessage({ type: "work-session-changed" });
    }
    return result;
  }

  async function resolveChoice(
    target: WorkSessionV1,
    choice: DirtyChoice,
  ): Promise<SwitchWorkSessionResult> {
    if (choice === "stay") return { kind: "failed", message: "仍停留在当前页" };
    if (choice === "new-tab") {
      const source = current.value;
      if (!source) return { kind: "failed", message: "当前工作现场尚未建立" };
      const popup = window.open("", "_blank");
      if (!popup) {
        return {
          kind: "failed",
          message: "浏览器阻止了新标签页，请允许弹出后重试",
        };
      }
      popup.opener = null;
      const validation = await input.adapter.validateTarget(target);
      if (validation.kind !== "ready") {
        popup.close();
        return validation;
      }
      try {
        const activated = await activateWorkSession(target.sessionId, {
          contractVersion: "work-session-activate.v1",
          sourceSessionId: source.sessionId,
          expectedSourceSessionVersion: source.version,
          expectedTargetSessionVersion: target.version,
          sourceStatus: "browser_held",
          domainVersionSeen: validation.domainVersionSeen,
          sourceDomainVersionSeen: input.domainVersionSeen.value,
          sourceActiveItemKey: input.activeItemKey?.value ?? null,
          sourceContextMode: input.contextMode?.value ?? null,
        });
        mutationEpoch += 1;
        const href = input.router.resolve(
          toRouteLocation(target.routeContext),
        ).href;
        popup.location.replace(href);
        channel?.postMessage({ type: "work-session-changed" });
        await load();
        return { kind: "switched", session: activated };
      } catch (caught) {
        popup.close();
        return {
          kind: "failed",
          message:
            caught instanceof Error ? caught.message : "新标签页没有打开",
        };
      }
    }
    if (choice === "discard") input.adapter.discardLocal();
    const original = input.adapter.settleBeforeLeave;
    input.adapter.settleBeforeLeave = async () => {
      if (choice === "save") {
        const saved = await original("switch");
        return saved.kind === "ready"
          ? { kind: "ready", sourceStatus: "draft_saved" }
          : saved;
      }
      return {
        kind: "ready",
        sourceStatus: "resumable",
      };
    };
    try {
      return await select(target);
    } finally {
      input.adapter.settleBeforeLeave = original;
    }
  }

  async function activate(args: {
    source: WorkSessionV1;
    target: WorkSessionV1;
    sourceStatus: "resumable" | "draft_saved" | "browser_held" | "conflict";
    domainVersionSeen: number | null;
  }) {
    return activateWorkSession(args.target.sessionId, {
      contractVersion: "work-session-activate.v1",
      sourceSessionId: args.source.sessionId,
      expectedSourceSessionVersion: args.source.version,
      expectedTargetSessionVersion: args.target.version,
      sourceStatus: args.sourceStatus,
      domainVersionSeen: args.domainVersionSeen,
      sourceDomainVersionSeen: input.domainVersionSeen.value,
      sourceActiveItemKey: input.activeItemKey?.value ?? null,
      sourceContextMode: input.contextMode?.value ?? null,
    });
  }

  onMounted(() => {
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    void initialize();
  });
  onBeforeUnmount(() => {
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
    channel?.removeEventListener("message", refresh);
    channel?.close();
  });
  watch(input.currentContext, () => {
    void ensureAndRestoreCurrent().catch((caught) => {
      error.value =
        caught instanceof Error ? caught.message : "工作现场没有建立";
    });
  });

  return {
    sessions: readonly(sessions),
    current,
    loading: readonly(loading),
    error: readonly(error),
    load,
    select,
    close,
    resolveChoice,
  };
}

function contextKey(context: WorkSessionRouteContextV1): string {
  return context.kind === "product_selection.v1"
    ? `product_selection|product_initiative_handoff:${context.handoffId}`
    : `stuffing|container:${context.containerId}|task:${context.taskId}`;
}

interface ExplicitRecoveryOwner {
  key: string;
  promise: Promise<void>;
  release(): void;
}

function createExplicitRecoveryOwner(key: string): ExplicitRecoveryOwner {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { key, promise, release };
}
