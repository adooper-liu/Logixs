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

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const page = await listWorkSessions();
      sessions.value = page.items;
      const serverCurrent = page.items.find(
        (session) => session.status === "current",
      );
      writeActiveSessionId(
        window.sessionStorage,
        serverCurrent?.sessionId ?? null,
      );
      await ensureCurrent();
    } catch (caught) {
      error.value =
        caught instanceof Error ? caught.message : "工作现场没有加载";
    } finally {
      loading.value = false;
    }
  }

  async function ensureCurrent(): Promise<void> {
    const context = input.currentContext.value;
    const subjectRef = input.currentSubjectRef.value;
    if (!context || !subjectRef) return;
    const currentKey = contextKey(context);
    if (sessions.value.some((session) => session.contextKey === currentKey))
      return;
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
    sessions.value = [
      opened,
      ...sessions.value.filter(
        (session) =>
          session.sessionId !== opened.sessionId &&
          session.contextKey !== opened.contextKey,
      ),
    ];
  }

  async function select(
    target: WorkSessionV1,
  ): Promise<SwitchWorkSessionResult> {
    const source = current.value;
    if (!source) return { kind: "failed", message: "当前工作现场尚未建立" };
    const result = await switchWorkSession({
      source,
      target,
      adapter: input.adapter,
      activate: activate,
      navigate: (context) => input.router.replace(toRouteLocation(context)),
    });
    if (result.kind === "conflict") {
      await updateWorkSession(target.sessionId, {
        contractVersion: "work-session-update.v1",
        expectedVersion: target.version,
        status: "conflict",
        domainVersionSeen: result.latestVersion,
      });
      await load();
      return result;
    }
    if (result.kind === "switched") {
      channel?.postMessage({ type: "work-session-changed" });
      await load();
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
    void load();
  });
  onBeforeUnmount(() => {
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
    channel?.removeEventListener("message", refresh);
    channel?.close();
  });
  watch(input.currentContext, () => void ensureCurrent());

  return {
    sessions: readonly(sessions),
    current,
    loading: readonly(loading),
    error: readonly(error),
    load,
    select,
    resolveChoice,
  };
}

function contextKey(context: WorkSessionRouteContextV1): string {
  return context.kind === "product_selection.v1"
    ? `product_selection|product_initiative_handoff:${context.handoffId}`
    : `stuffing|container:${context.containerId}|task:${context.taskId}`;
}
