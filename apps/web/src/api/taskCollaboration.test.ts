import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TaskCollaborationPageV1,
  TaskCollaborationPostCommandV1,
  TaskCollaborationPostResultV1,
} from "@logix/contracts";
import type { AuthSession, RequestCredentials } from "../auth/session";

const credentials = vi.fn<() => Promise<RequestCredentials>>();
vi.mock("../auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/session")>()),
  getAuthSession: () =>
    ({
      credentials,
      handleUnauthorized: vi.fn(),
      confirmAuthorized: vi.fn(),
    }) as unknown as AuthSession,
}));

const { listTaskCollaboration, postTaskCollaborationMessage } =
  await import("./taskCollaboration");
const { HttpRequestError } = await import("./httpClient");
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  credentials.mockResolvedValue({
    mode: "development",
    tenantId: "tenant-dev",
    operatorId: "operator-dev",
    roles: ["operations_dispatcher"],
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("task collaboration API", () => {
  it("encodes the task path and pagination query and forwards AbortSignal", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(ok(page()));

    await expect(
      listTaskCollaboration(
        "task/id with space",
        {
          subjectRef: { kind: "container", id: "container/id" },
          pageSize: 25,
          cursor: "older/+==",
        },
        controller.signal,
      ),
    ).resolves.toEqual(page());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/node-tasks/task%2Fid%20with%20space/collaboration?subjectKind=container&subjectId=container%2Fid&pageSize=25&cursor=older%2F%2B%3D%3D",
      expect.objectContaining({
        method: "GET",
        signal: controller.signal,
      }),
    );
  });

  it("posts the generated command unchanged to the exact messages path", async () => {
    const command = postCommand();
    const result: TaskCollaborationPostResultV1 = {
      contractVersion: "task-collaboration-post-result.v1",
      message: message(),
      idempotencyReplay: false,
    };
    fetchMock.mockResolvedValue(ok(result));

    await expect(
      postTaskCollaborationMessage("task/id", command),
    ).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/node-tasks/task%2Fid/collaboration/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent).toEqual(command);
    expect(sent).not.toHaveProperty("tenantId");
    expect(sent).not.toHaveProperty("authorActorId");
    expect(sent).not.toHaveProperty("visibility");
    expect(sent).not.toHaveProperty("capability");
    expect(sent).not.toHaveProperty("displayName");
  });

  it.each([403, 404, 409])(
    "preserves HttpRequestError for HTTP %s",
    async (status) => {
      fetchMock.mockResolvedValue(
        response(status, { message: `failure-${status}`, traceId: "trace-1" }),
      );

      const error = await listTaskCollaboration("task-1", {
        subjectRef: {
          kind: "container",
          id: "11111111-1111-4111-8111-111111111111",
        },
        pageSize: 25,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(HttpRequestError);
      expect(error).toMatchObject({ status, traceId: "trace-1" });
    },
  );

  it("preserves the shared network HttpRequestError", async () => {
    fetchMock.mockRejectedValue(new TypeError("connection lost"));

    const error = await postTaskCollaborationMessage(
      "task-1",
      postCommand(),
    ).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(HttpRequestError);
    expect(error).toMatchObject({ kind: "network", status: 0 });
  });
});

function page(): TaskCollaborationPageV1 {
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: {
      kind: "container",
      id: "11111111-1111-4111-8111-111111111111",
    },
    workRef: {
      kind: "node_task",
      id: "22222222-2222-4222-8222-222222222222",
    },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages: [],
    asOf: "2026-10-18T08:00:00.000Z",
    pageSize: 25,
    nextCursor: null,
    canPost: true,
    postDisabledReason: null,
    mentionOptions: [],
    evidenceOptions: [],
  };
}

function message(): TaskCollaborationPostResultV1["message"] {
  return {
    contractVersion: "task-collaboration-message.v1",
    messageId: "33333333-3333-4333-8333-333333333333",
    threadId: "44444444-4444-4444-8444-444444444444",
    author: { kind: "actor", id: "actor-1", displayName: "当前用户" },
    body: "请核对资料。",
    parentMessageId: null,
    mentions: [],
    evidenceRefs: [],
    sourceRefs: [],
    occurredAt: "2026-10-18T08:01:00.000Z",
    recordedAt: "2026-10-18T08:01:01.000Z",
  };
}

function postCommand(): TaskCollaborationPostCommandV1 {
  return {
    contractVersion: "task-collaboration-post-command.v1",
    subjectRef: {
      kind: "container",
      id: "11111111-1111-4111-8111-111111111111",
    },
    workRef: {
      kind: "node_task",
      id: "22222222-2222-4222-8222-222222222222",
    },
    body: "请核对资料。",
    parentMessageId: null,
    mentionActorIds: [],
    evidenceRecordIds: [],
    sourceRefs: [],
    idempotencyKey: "55555555-5555-4555-8555-555555555555",
  };
}

function ok(body: unknown): Response {
  return response(200, body);
}

function response(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
