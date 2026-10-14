import { computed, onMounted, readonly, ref, shallowRef, watch } from "vue";
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
import type {
  DirtyChoice,
  WorkSessionSwitchAdapter,
} from "./workSessionAdapter";
import {
  switchWorkSession,
  type SwitchWorkSessionResult,
} from "./useWorkSessions";

export function useWorkbenchSessionSwitcher(input: {
  router: { replace(location: unknown): Promise<unknown> };
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

  const current = computed(
    () =>
      sessions.value.find((session) => session.status === "current") ?? null,
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const page = await listWorkSessions();
      sessions.value = page.items;
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
    if (result.kind === "switched") await load();
    return result;
  }

  async function resolveChoice(
    target: WorkSessionV1,
    choice: DirtyChoice,
  ): Promise<SwitchWorkSessionResult> {
    if (choice === "stay") return { kind: "failed", message: "仍停留在当前页" };
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
        sourceStatus: choice === "new-tab" ? "browser_held" : "resumable",
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
    await updateWorkSession(args.source.sessionId, {
      contractVersion: "work-session-update.v1",
      expectedVersion: args.source.version,
      activeItemKey: input.activeItemKey?.value ?? null,
      contextMode: input.contextMode?.value ?? null,
      domainVersionSeen: input.domainVersionSeen.value,
    });
    return activateWorkSession(args.target.sessionId, {
      contractVersion: "work-session-activate.v1",
      sourceSessionId: args.source.sessionId,
      expectedSourceSessionVersion: args.source.version + 1,
      expectedTargetSessionVersion: args.target.version,
      sourceStatus: args.sourceStatus,
      domainVersionSeen: args.domainVersionSeen,
    });
  }

  onMounted(() => void load());
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
