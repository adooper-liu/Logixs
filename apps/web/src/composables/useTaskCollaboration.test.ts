import { nextTick, shallowRef } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TaskCollaborationMessageV1,
  TaskCollaborationPageV1,
  TaskCollaborationPostCommandV1,
  TaskCollaborationPostResultV1,
} from "@logix/contracts";
import { HttpRequestError } from "../api/httpClient";

const listTaskCollaboration = vi.fn();
const postTaskCollaborationMessage = vi.fn();
vi.mock("../api/taskCollaboration", () => ({
  listTaskCollaboration: (...args: unknown[]) => listTaskCollaboration(...args),
  postTaskCollaborationMessage: (...args: unknown[]) =>
    postTaskCollaborationMessage(...args),
}));

const { useTaskCollaboration } = await import("./useTaskCollaboration");

const subjectA = "11111111-1111-4111-8111-111111111111";
const subjectB = "22222222-2222-4222-8222-222222222222";
const taskA = "33333333-3333-4333-8333-333333333333";
const taskB = "44444444-4444-4444-8444-444444444444";

describe("useTaskCollaboration", () => {
  beforeEach(() => {
    listTaskCollaboration.mockReset();
    postTaskCollaborationMessage.mockReset();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => nextKey()) });
    keyIndex = 0;
  });

  it.each(["success", "error"])(
    "discards a late first-page %s from context A",
    async (outcome) => {
      const first = deferred<TaskCollaborationPageV1>();
      const second = deferred<TaskCollaborationPageV1>();
      listTaskCollaboration
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const context = shallowRef(collaborationContext("A", subjectA, taskA));
      const state = useTaskCollaboration(context);

      context.value = collaborationContext("B", subjectB, taskB);
      second.resolve(page("B", [message("b-message", "B")], { taskId: taskB }));
      await second.promise;
      await nextTick();

      if (outcome === "success") {
        first.resolve(
          page("A", [message("a-message", "A")], { taskId: taskA }),
        );
      } else {
        first.reject(new Error("A failed"));
      }
      await first.promise.catch(() => undefined);
      await nextTick();

      expect(state.messages.value.map((item) => item.body)).toEqual(["B"]);
      expect(state.error.value).toBe("");
    },
  );

  it("does not reload when only the equivalent context object identity changes", async () => {
    listTaskCollaboration.mockResolvedValueOnce(
      page("A", [message("a-message", "A")], { taskId: taskA }),
    );
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();

    context.value = collaborationContext("A", subjectA, taskA);
    await flush();

    expect(listTaskCollaboration).toHaveBeenCalledTimes(1);
    expect(state.messages.value.map((item) => item.body)).toEqual(["A"]);
  });

  it("uses each active context task and subject for A to B first pages", async () => {
    listTaskCollaboration
      .mockResolvedValueOnce(
        page("A", [message("a-message", "A")], { taskId: taskA }),
      )
      .mockResolvedValueOnce(
        page("B", [message("b-message", "B")], { taskId: taskB }),
      );
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    useTaskCollaboration(context);
    await flush();

    context.value = collaborationContext("B", subjectB, taskB);
    await flush();

    expect(listTaskCollaboration.mock.calls).toEqual([
      [
        taskA,
        {
          subjectRef: { kind: "container", id: subjectA },
          pageSize: 25,
        },
        expect.any(AbortSignal),
      ],
      [
        taskB,
        {
          subjectRef: { kind: "container", id: subjectB },
          pageSize: 25,
        },
        expect.any(AbortSignal),
      ],
    ]);
  });

  it.each(["loadMore", "post"])(
    "discards late %s success and error after switching A to B",
    async (operation) => {
      const late = deferred<
        TaskCollaborationPageV1 | TaskCollaborationPostResultV1
      >();
      listTaskCollaboration.mockResolvedValueOnce(
        page("A", [message("a-message", "A")], {
          taskId: taskA,
          nextCursor: "older-A",
        }),
      );
      if (operation === "loadMore") {
        listTaskCollaboration.mockReturnValueOnce(late.promise);
      } else {
        postTaskCollaborationMessage.mockReturnValueOnce(late.promise);
      }
      listTaskCollaboration.mockResolvedValueOnce(
        page("B", [message("b-message", "B")], { taskId: taskB }),
      );
      const context = shallowRef(collaborationContext("A", subjectA, taskA));
      const state = useTaskCollaboration(context);
      await flush();

      if (operation === "loadMore") void state.loadMore();
      else {
        state.draft.value = "A send";
        void state.send();
      }
      context.value = collaborationContext("B", subjectB, taskB);
      await flush();

      if (operation === "loadMore") {
        late.resolve(
          page("A", [message("late-a", "late A")], { taskId: taskA }),
        );
      } else {
        late.resolve({
          contractVersion: "task-collaboration-post-result.v1",
          message: message("late-a", "late A"),
          idempotencyReplay: false,
        });
      }
      await late.promise;
      await flush();

      expect(state.messages.value.map((item) => item.body)).toEqual(["B"]);
      expect(state.error.value).toBe("");
      expect(state.sendError.value).toBe("");
    },
  );

  it("synchronously clears all context-bound state and aborts old requests", async () => {
    const first = deferred<TaskCollaborationPageV1>();
    const second = deferred<TaskCollaborationPageV1>();
    listTaskCollaboration
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    const firstSignal = listTaskCollaboration.mock.calls[0]?.[2] as AbortSignal;
    state.draft.value = "secret draft";
    state.replyTo.value = message("reply", "reply");
    state.selectedMentionIds.value = ["actor-1"];
    state.selectedEvidenceIds.value = ["55555555-5555-4555-8555-555555555555"];

    context.value = collaborationContext("B", subjectB, taskB);

    expect(firstSignal.aborted).toBe(true);
    expect(state.messages.value).toEqual([]);
    expect(state.asOf.value).toBeNull();
    expect(state.hasMore.value).toBe(false);
    expect(state.mentionOptions.value).toEqual([]);
    expect(state.evidenceOptions.value).toEqual([]);
    expect(state.error.value).toBe("");
    expect(state.draft.value).toBe("");
    expect(state.replyTo.value).toBeNull();
    expect(state.selectedMentionIds.value).toEqual([]);
    expect(state.selectedEvidenceIds.value).toEqual([]);
    expect(state.pendingCommand.value).toBeNull();

    second.resolve(page("B", [], { taskId: taskB }));
    await second.promise;
  });

  it("restores pagination availability after a cleared context loads", async () => {
    listTaskCollaboration.mockResolvedValueOnce(
      page("B", [message("b-message", "B")], {
        taskId: taskB,
        nextCursor: "older-B",
      }),
    );
    const context = shallowRef<ReturnType<typeof collaborationContext> | null>(
      null,
    );
    const state = useTaskCollaboration(context);

    expect(state.hasMore.value).toBe(false);
    context.value = collaborationContext("B", subjectB, taskB);
    await flush();

    expect(state.hasMore.value).toBe(true);
  });

  it("keeps newest-first order and de-duplicates page boundaries", async () => {
    listTaskCollaboration
      .mockResolvedValueOnce(
        page("A", [message("new", "new"), message("boundary", "boundary")], {
          taskId: taskA,
          nextCursor: "older",
        }),
      )
      .mockResolvedValueOnce(
        page("A", [message("boundary", "boundary"), message("old", "old")], {
          taskId: taskA,
        }),
      );
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();

    await state.loadMore();

    expect(listTaskCollaboration.mock.calls[0]?.[1]).toEqual({
      subjectRef: { kind: "container", id: subjectA },
      pageSize: 25,
    });
    expect(listTaskCollaboration.mock.calls[1]?.[1]).toEqual({
      subjectRef: { kind: "container", id: subjectA },
      pageSize: 25,
      cursor: "older",
    });

    expect(state.messages.value.map((item) => item.body)).toEqual([
      "new",
      "boundary",
      "old",
    ]);
  });

  it("clears the thread and exposes a retryable error on snapshot drift", async () => {
    listTaskCollaboration
      .mockResolvedValueOnce(
        page("A", [message("new", "new")], {
          taskId: taskA,
          nextCursor: "older",
        }),
      )
      .mockResolvedValueOnce(
        page("A", [message("old", "old")], {
          taskId: taskA,
          asOf: "2026-10-18T09:00:00.000Z",
        }),
      );
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();

    await state.loadMore();

    expect(state.messages.value).toEqual([]);
    expect(state.asOf.value).toBeNull();
    expect(state.error.value).toContain("快照");
    expect(state.retryable.value).toBe(true);
  });

  it.each(["initial", "pagination"])(
    "clears sensitive thread state on %s failure",
    async (phase) => {
      if (phase === "pagination") {
        listTaskCollaboration.mockResolvedValueOnce(
          page("A", [message("secret", "secret")], {
            taskId: taskA,
            nextCursor: "older",
          }),
        );
      }
      listTaskCollaboration.mockRejectedValueOnce(new Error("FORBIDDEN"));
      const context = shallowRef(collaborationContext("A", subjectA, taskA));
      const state = useTaskCollaboration(context);
      await flush();
      if (phase === "pagination") await state.loadMore();

      expect(state.messages.value).toEqual([]);
      expect(state.mentionOptions.value).toEqual([]);
      expect(state.evidenceOptions.value).toEqual([]);
      expect(state.asOf.value).toBeNull();
      expect(state.hasMore.value).toBe(false);
      expect(state.error.value).not.toBe("");
    },
  );

  it("uses only server canPost, reason, and options", async () => {
    listTaskCollaboration.mockResolvedValueOnce(
      page("A", [], {
        taskId: taskA,
        canPost: false,
        postDisabledReason: "任务已完成，只能查看历史协作。",
      }),
    );
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();

    expect(state.canPost.value).toBe(false);
    expect(state.postDisabledReason.value).toBe(
      "任务已完成，只能查看历史协作。",
    );
    expect(state.mentionOptions.value).toEqual(mentionOptions);
    expect(state.evidenceOptions.value).toEqual(evidenceOptions);
  });

  it("does not add an optimistic message and de-duplicates the server result", async () => {
    listTaskCollaboration.mockResolvedValueOnce(
      page("A", [message("existing", "existing")], { taskId: taskA }),
    );
    const posted = deferred<TaskCollaborationPostResultV1>();
    postTaskCollaborationMessage.mockReturnValueOnce(posted.promise);
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();
    state.draft.value = "server result";

    const sending = state.send();
    expect(state.messages.value.map((item) => item.body)).toEqual(["existing"]);
    posted.resolve({
      contractVersion: "task-collaboration-post-result.v1",
      message: message("existing", "server result"),
      idempotencyReplay: true,
    });
    await sending;

    expect(state.messages.value).toHaveLength(1);
    expect(state.messages.value[0]?.body).toBe("server result");
    expect(state.idempotencyReplay.value).toBe(true);
  });

  it("retries a failed post with the exact command and idempotency key", async () => {
    listTaskCollaboration.mockResolvedValueOnce(
      page("A", [], { taskId: taskA }),
    );
    postTaskCollaborationMessage
      .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
      .mockResolvedValueOnce({
        contractVersion: "task-collaboration-post-result.v1",
        message: message("posted", "draft"),
        idempotencyReplay: true,
      });
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();
    state.draft.value = "draft";
    state.replyTo.value = message("parent", "parent");
    state.selectedMentionIds.value = ["actor-1"];
    state.selectedEvidenceIds.value = ["55555555-5555-4555-8555-555555555555"];

    await state.send();
    const failedCommand = postTaskCollaborationMessage.mock.calls[0]?.[1];
    expect(state.draft.value).toBe("draft");
    expect(state.pendingCommand.value).toEqual(failedCommand);
    await state.retrySend();

    expect(postTaskCollaborationMessage.mock.calls[1]?.[1]).toEqual(
      failedCommand,
    );
    expect(state.messages.value.map((item) => item.body)).toEqual(["draft"]);
  });

  it.each([403, 404])(
    "clears all collaboration and pending retry state after POST %s revokes scope",
    async (status) => {
      listTaskCollaboration.mockResolvedValueOnce(
        page("A", [message("secret", "secret")], { taskId: taskA }),
      );
      postTaskCollaborationMessage.mockRejectedValueOnce(
        new HttpRequestError({
          kind: status === 403 ? "forbidden" : "http",
          status,
          message: `POST_${status}`,
        }),
      );
      const context = shallowRef(collaborationContext("A", subjectA, taskA));
      const state = useTaskCollaboration(context);
      await flush();
      state.draft.value = "sensitive draft";
      state.replyTo.value = message("parent", "parent");
      state.selectedMentionIds.value = ["actor-1"];
      state.selectedEvidenceIds.value = [
        "55555555-5555-4555-8555-555555555555",
      ];

      await state.send();

      expect(state.messages.value).toEqual([]);
      expect(state.asOf.value).toBeNull();
      expect(state.visibility.value).toBeNull();
      expect(state.visibilityLabel.value).toBe("");
      expect(state.canPost.value).toBe(false);
      expect(state.mentionOptions.value).toEqual([]);
      expect(state.evidenceOptions.value).toEqual([]);
      expect(state.draft.value).toBe("");
      expect(state.replyTo.value).toBeNull();
      expect(state.selectedMentionIds.value).toEqual([]);
      expect(state.selectedEvidenceIds.value).toEqual([]);
      expect(state.pendingCommand.value).toBeNull();
      expect(state.sendError.value).toBe("");
      expect(state.error.value).toContain("重新读取");
      expect(state.retryable.value).toBe(true);
      await state.retrySend();
      expect(postTaskCollaborationMessage).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { status: 403, latePage: "success" },
    { status: 404, latePage: "failure" },
  ] as const)(
    "keeps POST $status revocation state after a late pagination $latePage",
    async ({ status, latePage }) => {
      const pagination = deferred<TaskCollaborationPageV1>();
      listTaskCollaboration
        .mockResolvedValueOnce(
          page("A", [message("secret", "secret")], {
            taskId: taskA,
            nextCursor: "older-A",
          }),
        )
        .mockReturnValueOnce(pagination.promise);
      postTaskCollaborationMessage.mockRejectedValueOnce(
        new HttpRequestError({
          kind: status === 403 ? "forbidden" : "http",
          status,
          message: `POST_${status}`,
        }),
      );
      const context = shallowRef(collaborationContext("A", subjectA, taskA));
      const state = useTaskCollaboration(context);
      await flush();

      const loadingMore = state.loadMore();
      const paginationSignal = listTaskCollaboration.mock
        .calls[1]?.[2] as AbortSignal;
      state.draft.value = "sensitive draft";
      state.replyTo.value = message("parent", "parent");
      state.selectedMentionIds.value = ["actor-1"];
      state.selectedEvidenceIds.value = [
        "55555555-5555-4555-8555-555555555555",
      ];
      await state.send();

      expect(paginationSignal.aborted).toBe(true);
      expect(state.messages.value).toEqual([]);
      expect(state.error.value).toContain("重新读取");
      if (latePage === "success") {
        pagination.resolve(
          page("A", [message("late-secret", "late secret")], {
            taskId: taskA,
          }),
        );
      } else {
        pagination.reject(new Error("late pagination failed"));
      }
      await loadingMore;
      await flush();

      expect(state.messages.value).toEqual([]);
      expect(state.mentionOptions.value).toEqual([]);
      expect(state.evidenceOptions.value).toEqual([]);
      expect(state.draft.value).toBe("");
      expect(state.replyTo.value).toBeNull();
      expect(state.selectedMentionIds.value).toEqual([]);
      expect(state.selectedEvidenceIds.value).toEqual([]);
      expect(state.pendingCommand.value).toBeNull();
      expect(state.error.value).toContain("重新读取");
      expect(state.retryable.value).toBe(true);
    },
  );

  it.each(["body", "reply", "mention", "evidence"])(
    "invalidates the failed command and creates a new key after %s changes",
    async (field) => {
      listTaskCollaboration.mockResolvedValueOnce(
        page("A", [], { taskId: taskA }),
      );
      postTaskCollaborationMessage
        .mockRejectedValueOnce(new Error("failed"))
        .mockResolvedValueOnce({
          contractVersion: "task-collaboration-post-result.v1",
          message: message("posted", "changed"),
          idempotencyReplay: false,
        });
      const context = shallowRef(collaborationContext("A", subjectA, taskA));
      const state = useTaskCollaboration(context);
      await flush();
      state.draft.value = "draft";
      await state.send();
      const first = postTaskCollaborationMessage.mock
        .calls[0]?.[1] as TaskCollaborationPostCommandV1;

      if (field === "body") state.draft.value = "changed";
      if (field === "reply") state.replyTo.value = message("parent", "parent");
      if (field === "mention") state.selectedMentionIds.value = ["actor-1"];
      if (field === "evidence") {
        state.selectedEvidenceIds.value = [
          "55555555-5555-4555-8555-555555555555",
        ];
      }
      await nextTick();

      expect(state.pendingCommand.value).toBeNull();
      await state.send();
      const second = postTaskCollaborationMessage.mock
        .calls[1]?.[1] as TaskCollaborationPostCommandV1;
      expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    },
  );

  it("removes failed retry state when context changes", async () => {
    listTaskCollaboration
      .mockResolvedValueOnce(page("A", [], { taskId: taskA }))
      .mockResolvedValueOnce(page("B", [], { taskId: taskB }));
    postTaskCollaborationMessage.mockRejectedValueOnce(new Error("failed"));
    const context = shallowRef(collaborationContext("A", subjectA, taskA));
    const state = useTaskCollaboration(context);
    await flush();
    state.draft.value = "draft";
    await state.send();

    context.value = collaborationContext("B", subjectB, taskB);
    expect(state.pendingCommand.value).toBeNull();
    expect(state.sendError.value).toBe("");
    expect(state.draft.value).toBe("");
    await state.retrySend();
    expect(postTaskCollaborationMessage).toHaveBeenCalledTimes(1);
  });
});

const mentionOptions: TaskCollaborationPageV1["mentionOptions"] = [
  { kind: "actor", id: "actor-1", displayName: "当前用户" },
];
const evidenceOptions: TaskCollaborationPageV1["evidenceOptions"] = [
  {
    ref: {
      kind: "evidence_record",
      id: "55555555-5555-4555-8555-555555555555",
    },
    label: "装箱照片",
  },
];

function collaborationContext(key: string, subjectId: string, taskId: string) {
  return {
    contextKey: key,
    taskId,
    subjectRef: { kind: "container" as const, id: subjectId },
    workRef: { kind: "node_task" as const, id: taskId },
  };
}

function page(
  key: string,
  messages: TaskCollaborationMessageV1[],
  options: {
    taskId: string;
    nextCursor?: string | null;
    asOf?: string;
    canPost?: boolean;
    postDisabledReason?: string | null;
  },
): TaskCollaborationPageV1 {
  const subjectId = key === "A" ? subjectA : subjectB;
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: { kind: "container", id: subjectId },
    workRef: { kind: "node_task", id: options.taskId },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages,
    asOf: options.asOf ?? "2026-10-18T08:00:00.000Z",
    pageSize: 25,
    nextCursor: options.nextCursor ?? null,
    canPost: options.canPost ?? true,
    postDisabledReason: options.postDisabledReason ?? null,
    mentionOptions,
    evidenceOptions,
  };
}

function message(id: string, body: string): TaskCollaborationMessageV1 {
  const uuid = uuidFor(id);
  return {
    contractVersion: "task-collaboration-message.v1",
    messageId: uuid,
    threadId: "66666666-6666-4666-8666-666666666666",
    author: { kind: "actor", id: "actor-1", displayName: "当前用户" },
    body,
    parentMessageId: null,
    mentions: [],
    evidenceRefs: [],
    sourceRefs: [],
    occurredAt: "2026-10-18T08:01:00.000Z",
    recordedAt: "2026-10-18T08:01:01.000Z",
  };
}

function uuidFor(value: string): string {
  let sum = 1;
  for (const char of value) sum = (sum * 31 + char.charCodeAt(0)) % 99999999;
  return `${String(sum).padStart(8, "0")}-7777-4777-8777-777777777777`;
}

let keyIndex = 0;
function nextKey(): `${string}-${string}-${string}-${string}-${string}` {
  keyIndex += 1;
  return `${String(keyIndex).padStart(8, "0")}-8888-4888-8888-888888888888`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}
