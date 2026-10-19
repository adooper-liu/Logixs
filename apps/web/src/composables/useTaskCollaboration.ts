import type {
  CollaborationActorRefV1,
  CollaborationEvidenceOptionV1,
  CollaborationSubjectRefV1,
  CollaborationWorkRefV1,
  TaskCollaborationMessageV1,
  TaskCollaborationPostCommandV1,
  TaskCollaborationVisibilityV1,
} from "@logix/contracts";
import {
  computed,
  ref,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
} from "vue";
import {
  listTaskCollaboration,
  postTaskCollaborationMessage,
} from "../api/taskCollaboration";
import { HttpRequestError } from "../api/httpClient";

const PAGE_SIZE = 25;
const SNAPSHOT_CHANGED = "协作消息分页快照已变化，请重试";

export interface TaskCollaborationContext {
  contextKey: string;
  taskId: string;
  subjectRef: CollaborationSubjectRefV1;
  workRef: CollaborationWorkRefV1;
}

export type TaskCollaborationRetryTarget = "thread" | "send";

export interface TaskCollaborationPanelModel {
  messages: ShallowRef<TaskCollaborationMessageV1[]>;
  asOf: ShallowRef<string | null>;
  visibility: ShallowRef<TaskCollaborationVisibilityV1 | null>;
  visibilityLabel: ShallowRef<string>;
  canPost: ShallowRef<boolean>;
  postDisabledReason: ShallowRef<string | null>;
  mentionOptions: ShallowRef<CollaborationActorRefV1[]>;
  evidenceOptions: ShallowRef<CollaborationEvidenceOptionV1[]>;
  loading: ShallowRef<boolean>;
  loadingMore: ShallowRef<boolean>;
  sending: ShallowRef<boolean>;
  error: ShallowRef<string>;
  sendError: ShallowRef<string>;
  hasMore: Readonly<Ref<boolean>>;
  retryable: ShallowRef<boolean>;
  draft: Ref<string>;
  replyTo: ShallowRef<TaskCollaborationMessageV1 | null>;
  selectedMentionIds: Ref<string[]>;
  selectedEvidenceIds: Ref<string[]>;
  pendingCommand: ShallowRef<TaskCollaborationPostCommandV1 | null>;
  idempotencyReplay: ShallowRef<boolean | null>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  send(): Promise<void>;
  retrySend(): Promise<void>;
  setDraft(value: string): void;
  setMentionSelected(actorId: string, selected: boolean): void;
  setEvidenceSelected(evidenceId: string, selected: boolean): void;
  startReply(message: TaskCollaborationMessageV1): void;
  cancelReply(): void;
}

export function useTaskCollaboration(
  context: Readonly<Ref<TaskCollaborationContext | null>>,
): TaskCollaborationPanelModel {
  const messages = shallowRef<TaskCollaborationMessageV1[]>([]);
  const asOf = shallowRef<string | null>(null);
  const visibility = shallowRef<TaskCollaborationVisibilityV1 | null>(null);
  const visibilityLabel = shallowRef("");
  const canPost = shallowRef(false);
  const postDisabledReason = shallowRef<string | null>(null);
  const mentionOptions = shallowRef<CollaborationActorRefV1[]>([]);
  const evidenceOptions = shallowRef<CollaborationEvidenceOptionV1[]>([]);
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const sending = shallowRef(false);
  const error = shallowRef("");
  const sendError = shallowRef("");
  const retryable = shallowRef(false);
  const draft = ref("");
  const replyTo = shallowRef<TaskCollaborationMessageV1 | null>(null);
  const selectedMentionIds = ref<string[]>([]);
  const selectedEvidenceIds = ref<string[]>([]);
  const pendingCommand = shallowRef<TaskCollaborationPostCommandV1 | null>(
    null,
  );
  const idempotencyReplay = shallowRef<boolean | null>(null);
  const nextCursor = shallowRef<string | null>(null);
  const hasMore = computed(() => Boolean(nextCursor.value));
  const controllers = new Set<AbortController>();
  let generation = 0;
  let activeContext: TaskCollaborationContext | null = null;
  let resetting = false;

  function abortRequests(): void {
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  function clearThread(): void {
    messages.value = [];
    asOf.value = null;
    visibility.value = null;
    visibilityLabel.value = "";
    canPost.value = false;
    postDisabledReason.value = null;
    mentionOptions.value = [];
    evidenceOptions.value = [];
    nextCursor.value = null;
  }

  function clearContextState(): void {
    resetting = true;
    clearThread();
    error.value = "";
    retryable.value = false;
    draft.value = "";
    replyTo.value = null;
    selectedMentionIds.value = [];
    selectedEvidenceIds.value = [];
    pendingCommand.value = null;
    sendError.value = "";
    idempotencyReplay.value = null;
    loadingMore.value = false;
    sending.value = false;
    resetting = false;
  }

  function failThread(cause: unknown, fallback: string): void {
    clearThread();
    error.value = errorMessage(cause, fallback);
    retryable.value = true;
  }

  function requestIsCurrent(
    requestGeneration: number,
    contextKey: string,
  ): boolean {
    return (
      requestGeneration === generation &&
      activeContext?.contextKey === contextKey
    );
  }

  function requestController(): AbortController {
    const controller = new AbortController();
    controllers.add(controller);
    return controller;
  }

  async function loadFirstPage(
    selected: TaskCollaborationContext,
    requestGeneration: number,
  ): Promise<void> {
    const controller = requestController();
    try {
      const page = await listTaskCollaboration(
        selected.taskId,
        { subjectRef: selected.subjectRef, pageSize: PAGE_SIZE },
        controller.signal,
      );
      if (!requestIsCurrent(requestGeneration, selected.contextKey)) return;
      messages.value = deduplicate(page.messages);
      asOf.value = page.asOf;
      visibility.value = page.visibility;
      visibilityLabel.value = page.visibilityLabel;
      canPost.value = page.canPost;
      postDisabledReason.value = page.postDisabledReason;
      mentionOptions.value = page.mentionOptions;
      evidenceOptions.value = page.evidenceOptions;
      nextCursor.value = page.nextCursor;
      error.value = "";
      retryable.value = false;
    } catch (cause) {
      if (!requestIsCurrent(requestGeneration, selected.contextKey)) return;
      failThread(cause, "任务协作暂时不可用");
    } finally {
      controllers.delete(controller);
      if (requestIsCurrent(requestGeneration, selected.contextKey)) {
        loading.value = false;
      }
    }
  }

  function activateContext(selected: TaskCollaborationContext | null): void {
    generation += 1;
    abortRequests();
    activeContext = selected;
    clearContextState();
    loading.value = Boolean(selected);
    if (selected) void loadFirstPage(selected, generation);
  }

  watch(
    () => context.value?.contextKey ?? "",
    () => activateContext(context.value),
    { immediate: true, flush: "sync" },
  );

  watch(
    [draft, replyTo, selectedMentionIds, selectedEvidenceIds],
    () => {
      if (resetting || !pendingCommand.value) return;
      pendingCommand.value = null;
      sendError.value = "";
      idempotencyReplay.value = null;
    },
    { deep: true, flush: "sync" },
  );

  async function refresh(): Promise<void> {
    const selected = activeContext;
    if (!selected) return;
    generation += 1;
    abortRequests();
    clearThread();
    error.value = "";
    retryable.value = false;
    loading.value = true;
    await loadFirstPage(selected, generation);
  }

  async function loadMore(): Promise<void> {
    const selected = activeContext;
    const cursor = nextCursor.value;
    const snapshot = asOf.value;
    if (!selected || !cursor || !snapshot || loadingMore.value) return;
    const requestGeneration = generation;
    const controller = requestController();
    loadingMore.value = true;
    error.value = "";
    retryable.value = false;
    try {
      const page = await listTaskCollaboration(
        selected.taskId,
        { subjectRef: selected.subjectRef, pageSize: PAGE_SIZE, cursor },
        controller.signal,
      );
      if (!requestIsCurrent(requestGeneration, selected.contextKey)) return;
      if (page.asOf !== snapshot) {
        failThread(SNAPSHOT_CHANGED, SNAPSHOT_CHANGED);
        return;
      }
      const known = new Set(messages.value.map(({ messageId }) => messageId));
      messages.value = [
        ...messages.value,
        ...page.messages.filter(({ messageId }) => !known.has(messageId)),
      ];
      nextCursor.value = page.nextCursor;
    } catch (cause) {
      if (!requestIsCurrent(requestGeneration, selected.contextKey)) return;
      failThread(cause, "读取更早协作消息失败，请重试");
    } finally {
      controllers.delete(controller);
      if (requestIsCurrent(requestGeneration, selected.contextKey)) {
        loadingMore.value = false;
      }
    }
  }

  async function send(): Promise<void> {
    const selected = activeContext;
    const body = draft.value.trim();
    if (!selected || !canPost.value || !body || sending.value) return;
    const command: TaskCollaborationPostCommandV1 = {
      contractVersion: "task-collaboration-post-command.v1",
      subjectRef: selected.subjectRef,
      workRef: selected.workRef,
      body,
      parentMessageId: replyTo.value?.messageId ?? null,
      mentionActorIds: [
        ...selectedMentionIds.value,
      ] as TaskCollaborationPostCommandV1["mentionActorIds"],
      evidenceRecordIds: [
        ...selectedEvidenceIds.value,
      ] as TaskCollaborationPostCommandV1["evidenceRecordIds"],
      sourceRefs: [],
      idempotencyKey: crypto.randomUUID(),
    };
    pendingCommand.value = command;
    sendError.value = "";
    idempotencyReplay.value = null;
    await sendCommand(selected, command, generation);
  }

  async function retrySend(): Promise<void> {
    const selected = activeContext;
    const command = pendingCommand.value;
    if (!selected || !command || sending.value) return;
    sendError.value = "";
    await sendCommand(selected, command, generation);
  }

  async function sendCommand(
    selected: TaskCollaborationContext,
    command: TaskCollaborationPostCommandV1,
    requestGeneration: number,
  ): Promise<void> {
    const controller = requestController();
    sending.value = true;
    try {
      const result = await postTaskCollaborationMessage(
        selected.taskId,
        command,
        controller.signal,
      );
      if (!requestIsCurrent(requestGeneration, selected.contextKey)) return;
      messages.value = [
        result.message,
        ...messages.value.filter(
          ({ messageId }) => messageId !== result.message.messageId,
        ),
      ];
      resetting = true;
      pendingCommand.value = null;
      draft.value = "";
      replyTo.value = null;
      selectedMentionIds.value = [];
      selectedEvidenceIds.value = [];
      resetting = false;
      sendError.value = "";
      idempotencyReplay.value = result.idempotencyReplay;
    } catch (cause) {
      if (!requestIsCurrent(requestGeneration, selected.contextKey)) return;
      if (
        cause instanceof HttpRequestError &&
        (cause.status === 403 || cause.status === 404)
      ) {
        generation += 1;
        abortRequests();
        clearContextState();
        error.value = "任务协作范围已变化，请重新读取或确认授权。";
        retryable.value = true;
        return;
      }
      sendError.value = errorMessage(cause, "发送协作消息失败，请重试");
    } finally {
      controllers.delete(controller);
      if (requestIsCurrent(requestGeneration, selected.contextKey)) {
        sending.value = false;
      }
    }
  }

  function startReply(message: TaskCollaborationMessageV1): void {
    replyTo.value = message;
  }

  function cancelReply(): void {
    replyTo.value = null;
  }

  function setDraft(value: string): void {
    draft.value = value;
  }

  function setMentionSelected(actorId: string, selected: boolean): void {
    selectedMentionIds.value = updateSelection(
      selectedMentionIds.value,
      actorId,
      selected,
    );
  }

  function setEvidenceSelected(evidenceId: string, selected: boolean): void {
    selectedEvidenceIds.value = updateSelection(
      selectedEvidenceIds.value,
      evidenceId,
      selected,
    );
  }

  return {
    messages,
    asOf,
    visibility,
    visibilityLabel,
    canPost,
    postDisabledReason,
    mentionOptions,
    evidenceOptions,
    loading,
    loadingMore,
    sending,
    error,
    sendError,
    hasMore,
    retryable,
    draft,
    replyTo,
    selectedMentionIds,
    selectedEvidenceIds,
    pendingCommand,
    idempotencyReplay,
    refresh,
    loadMore,
    send,
    retrySend,
    setDraft,
    setMentionSelected,
    setEvidenceSelected,
    startReply,
    cancelReply,
  };
}

function updateSelection(
  values: string[],
  value: string,
  selected: boolean,
): string[] {
  if (selected) return values.includes(value) ? values : [...values, value];
  return values.filter((item) => item !== value);
}

function deduplicate(
  input: TaskCollaborationMessageV1[],
): TaskCollaborationMessageV1[] {
  const seen = new Set<string>();
  return input.filter(({ messageId }) => {
    if (seen.has(messageId)) return false;
    seen.add(messageId);
    return true;
  });
}

function errorMessage(cause: unknown, fallback: string): string {
  if (typeof cause === "string" && cause) return cause;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
