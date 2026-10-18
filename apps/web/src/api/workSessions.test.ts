import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkSessionV1 } from "@logix/contracts";
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

const { listWorkSessions, openWorkSession } = await import("./workSessions");
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

describe("workSessions API", () => {
  it("lists the authenticated actor sessions through the shared client", async () => {
    const page = {
      contractVersion: "work-session-page.v1",
      items: [],
      pageSize: 100,
      nextCursor: null,
    };
    fetchMock.mockResolvedValue(ok(page));
    await expect(listWorkSessions()).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith("/api/work-sessions?pageSize=100", {
      method: "GET",
      redirect: "error",
      headers: {
        "X-Tenant-Id": "tenant-dev",
        "X-Operator-Id": "operator-dev",
        "X-Roles": "operations_dispatcher",
      },
    });
  });

  it("requests closed sessions only through an explicit query", async () => {
    fetchMock.mockResolvedValue(
      ok({
        contractVersion: "work-session-page.v1",
        items: [],
        pageSize: 100,
        nextCursor: null,
      }),
    );

    await listWorkSessions({ includeClosed: true });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/work-sessions?pageSize=100&includeClosed=true",
    );
  });

  it("consumes every page and keeps mixed live and closed sessions without duplicate ids", async () => {
    const current = workSession("current", "current");
    const firstPageLive = Array.from({ length: 99 }, (_, index) =>
      workSession(`first-page-${index}`, "resumable"),
    );
    const duplicate = firstPageLive.at(-1)!;
    const secondPageLive = workSession("second-live", "resumable");
    const secondPageClosed = workSession("second-closed", "closed");
    fetchMock
      .mockResolvedValueOnce(
        ok({
          contractVersion: "work-session-page.v1",
          items: [current, ...firstPageLive],
          pageSize: 100,
          nextCursor: "page-2",
        }),
      )
      .mockResolvedValueOnce(
        ok({
          contractVersion: "work-session-page.v1",
          items: [duplicate, secondPageLive, secondPageClosed],
          pageSize: 100,
          nextCursor: null,
        }),
      );

    const result = await listWorkSessions({ includeClosed: true });
    expect(result.items).toHaveLength(102);
    expect(result.items).toEqual(
      expect.arrayContaining([current, secondPageLive, secondPageClosed]),
    );
    expect(
      result.items.filter(({ sessionId }) => sessionId === duplicate.sessionId),
    ).toHaveLength(1);
    expect(result).toMatchObject({ pageSize: 100, nextCursor: null });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/work-sessions?pageSize=100&includeClosed=true",
      "/api/work-sessions?pageSize=100&cursor=page-2&includeClosed=true",
    ]);
  });

  it("fails closed when the server repeats a pagination cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok({
          contractVersion: "work-session-page.v1",
          items: [workSession("current", "current")],
          pageSize: 100,
          nextCursor: "same-cursor",
        }),
      )
      .mockResolvedValueOnce(
        ok({
          contractVersion: "work-session-page.v1",
          items: [workSession("later", "resumable")],
          pageSize: 100,
          nextCursor: "same-cursor",
        }),
      );

    await expect(listWorkSessions()).rejects.toThrow(
      "WORK_SESSION_PAGINATION_CURSOR_LOOP",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not add tenant or owner fields to open commands", async () => {
    fetchMock.mockResolvedValue(ok({ sessionId: "session-1" }));
    await openWorkSession({
      contractVersion: "work-session-open.v1",
      workbenchCode: "product_selection",
      routeContext: {
        kind: "product_selection.v1",
        handoffId: "22222222-2222-4222-8222-222222222222",
      },
      subjectRef: {
        kind: "product_initiative_handoff",
        id: "22222222-2222-4222-8222-222222222222",
      },
      displaySummary: "选品",
    });
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request.body))).not.toHaveProperty("tenantId");
    expect(JSON.parse(String(request.body))).not.toHaveProperty("ownerActorId");
  });
});

function ok(body: unknown) {
  return {
    status: 200,
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function workSession(
  sessionId: string,
  status: WorkSessionV1["status"],
): WorkSessionV1 {
  return {
    contractVersion: "work-session.v1",
    sessionId,
    version: 1,
    status,
    workbenchCode: "product_selection",
    contextKey: `product_selection|product_initiative_handoff:${sessionId}`,
    routeContext: {
      kind: "product_selection.v1",
      handoffId: "22222222-2222-4222-8222-222222222222",
    },
    subjectRef: {
      kind: "product_initiative_handoff",
      id: "22222222-2222-4222-8222-222222222222",
    },
    domainVersionSeen: 1,
    displaySummary: sessionId,
    lastOpenedAt: "2026-10-18T00:00:00.000Z",
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
  };
}
