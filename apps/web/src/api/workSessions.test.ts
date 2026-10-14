import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      pageSize: 50,
      nextCursor: null,
    };
    fetchMock.mockResolvedValue(ok(page));
    await expect(listWorkSessions()).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith("/api/work-sessions?pageSize=50", {
      method: "GET",
      redirect: "error",
      headers: {
        "X-Tenant-Id": "tenant-dev",
        "X-Operator-Id": "operator-dev",
        "X-Roles": "operations_dispatcher",
      },
    });
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
