import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ActivateWorkSessionService } from "../application/activate-work-session.service";
import { CloseWorkSessionService } from "../application/close-work-session.service";
import { ListWorkSessionsService } from "../application/list-work-sessions.service";
import { OpenWorkSessionService } from "../application/open-work-session.service";
import { UpdateWorkSessionService } from "../application/update-work-session.service";
import { WORK_SESSION_REPOSITORY } from "../domain/work-session.repository";
import type { WorkSessionRecord } from "../domain/work-session.repository";
import { WorkSessionsController } from "./work-sessions.controller";

const SESSION: WorkSessionRecord = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  version: 4,
  status: "browser_held",
  workbenchCode: "product_selection",
  contextKey:
    "product_selection|product_initiative_handoff:22222222-2222-4222-8222-222222222222",
  routeContext: {
    kind: "product_selection.v1",
    handoffId: "22222222-2222-4222-8222-222222222222",
  },
  subjectRef: {
    kind: "product_initiative_handoff",
    id: "22222222-2222-4222-8222-222222222222",
  },
  taskRef: null,
  draftRef: null,
  domainVersionSeen: 3,
  activeItemKey: "objective",
  contextMode: "context",
  displaySummary: "选品",
  lastOpenedAt: new Date("2026-10-14T08:00:00.000Z"),
  createdAt: new Date("2026-10-14T08:00:00.000Z"),
  updatedAt: new Date("2026-10-14T08:00:00.000Z"),
};

const repository = {
  list: vi.fn(),
  findById: vi.fn(),
  openOrFocus: vi.fn(),
  close: vi.fn(),
  updatePointer: vi.fn(),
  activate: vi.fn(),
};
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const listSessions = new ListWorkSessionsService(repository);
  const updateSession = new UpdateWorkSessionService(repository);
  const closeSession = new CloseWorkSessionService(repository);
  const openSession = { execute: vi.fn() };
  const activateSession = { execute: vi.fn() };
  const moduleRef = await Test.createTestingModule({
    controllers: [WorkSessionsController],
    providers: [
      { provide: ListWorkSessionsService, useValue: listSessions },
      { provide: UpdateWorkSessionService, useValue: updateSession },
      { provide: CloseWorkSessionService, useValue: closeSession },
      { provide: OpenWorkSessionService, useValue: openSession },
      { provide: ActivateWorkSessionService, useValue: activateSession },
      { provide: WORK_SESSION_REPOSITORY, useValue: repository },
    ],
  }).compile();
  Object.assign(moduleRef.get(WorkSessionsController), {
    listSessions,
    openSession,
    updateSession,
    activateSession,
    closeSession,
  });
  app = moduleRef.createNestApplication();
  app.use(
    (request: { identity?: unknown }, _response: unknown, next: () => void) => {
      request.identity = { tenantId: "tenant-1", actorId: "actor-1" };
      next();
    },
  );
  app.setGlobalPrefix("api");
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}/api/work-sessions`;
});

afterAll(async () => app.close());

beforeEach(() => {
  vi.clearAllMocks();
  repository.list.mockResolvedValue([]);
  repository.findById.mockResolvedValue(SESSION);
});

describe("work session HTTP query validation", () => {
  for (const [query, expected] of [
    ["", false],
    ["?includeClosed=false", false],
    ["?includeClosed=true", true],
  ] as const) {
    it(`maps ${query || "an omitted includeClosed"} to ${expected}`, async () => {
      const response = await fetch(`${baseUrl}${query}`);
      expect(response.status).toBe(200);
      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ includeClosed: expected }),
      );
    });
  }

  for (const query of [
    "?includeClosed=yes",
    "?includeClosed=",
    "?includeClosed=true&includeClosed=false",
  ]) {
    it(`rejects ${query} with 400 before repository access`, async () => {
      const response = await fetch(`${baseUrl}${query}`);
      expect(response.status).toBe(400);
      expect(repository.list).not.toHaveBeenCalled();
    });
  }
});

describe("work session HTTP lifecycle boundaries", () => {
  it("returns the stable browser-held close conflict without writing", async () => {
    const response = await fetch(`${baseUrl}/${SESSION.sessionId}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractVersion: "work-session-close.v1",
        expectedVersion: SESSION.version,
      }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "WORK_SESSION_BROWSER_HELD_CLOSE_REQUIRES_ORIGINAL_TAB",
    });
    expect(repository.close).not.toHaveBeenCalled();
  });

  it("returns the stable closed-terminal conflict without updating", async () => {
    repository.findById.mockResolvedValue({ ...SESSION, status: "closed" });
    const response = await fetch(`${baseUrl}/${SESSION.sessionId}/pointer`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractVersion: "work-session-update.v1",
        expectedVersion: SESSION.version,
        status: "resumable",
      }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "WORK_SESSION_CLOSED_TERMINAL",
    });
    expect(repository.updatePointer).not.toHaveBeenCalled();
  });
});
