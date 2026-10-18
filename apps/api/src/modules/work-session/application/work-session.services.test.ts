import { describe, expect, it, vi } from "vitest";
import { WorkSessionConflictError } from "../domain/work-session";
import type {
  WorkSessionRecord,
  WorkSessionRepository,
} from "../domain/work-session.repository";
import { ActivateWorkSessionService } from "./activate-work-session.service";
import { CloseWorkSessionService } from "./close-work-session.service";
import { ListWorkSessionsService } from "./list-work-sessions.service";
import { UpdateWorkSessionService } from "./update-work-session.service";
import { OpenWorkSessionService } from "./open-work-session.service";

const HANDOFF_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-14T08:00:00.000Z");
const EXISTING: WorkSessionRecord = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  version: 4,
  status: "current",
  workbenchCode: "product_selection",
  contextKey: `product_selection|product_initiative_handoff:${HANDOFF_ID}`,
  routeContext: { kind: "product_selection.v1", handoffId: HANDOFF_ID },
  subjectRef: { kind: "product_initiative_handoff", id: HANDOFF_ID },
  taskRef: null,
  draftRef: null,
  domainVersionSeen: 3,
  activeItemKey: null,
  contextMode: null,
  displaySummary: "选品 · 加拿大户外储物柜",
  lastOpenedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("OpenWorkSessionService", () => {
  it("returns the existing live session for the same canonical context", async () => {
    const repository = repositoryHarness();
    repository.openOrFocus.mockResolvedValue({
      record: EXISTING,
      created: false,
    });
    const service = new OpenWorkSessionService(repository);

    const result = await service.execute({
      tenantId: "tenant-1",
      actorId: "actor-1",
      command: {
        contractVersion: "work-session-open.v1",
        workbenchCode: "product_selection",
        routeContext: { kind: "product_selection.v1", handoffId: HANDOFF_ID },
        subjectRef: { kind: "product_initiative_handoff", id: HANDOFF_ID },
        displaySummary: "选品 · 加拿大户外储物柜",
      },
    });

    expect(result.sessionId).toBe(EXISTING.sessionId);
    expect(repository.openOrFocus).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "actor-1",
        contextKey: EXISTING.contextKey,
      }),
    );
  });

  it("rejects mismatched route and subject references before persistence", async () => {
    const repository = repositoryHarness();
    const service = new OpenWorkSessionService(repository);
    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        command: {
          contractVersion: "work-session-open.v1",
          workbenchCode: "product_selection",
          routeContext: { kind: "product_selection.v1", handoffId: HANDOFF_ID },
          subjectRef: {
            kind: "product_initiative_handoff",
            id: "33333333-3333-4333-8333-333333333333",
          },
          displaySummary: "错配现场",
        },
      }),
    ).rejects.toThrow("WORK_SESSION_REFERENCE_MISMATCH");
    expect(repository.openOrFocus).not.toHaveBeenCalled();
  });

  it("rejects undeclared request keys at runtime", async () => {
    const repository = repositoryHarness();
    const service = new OpenWorkSessionService(repository);
    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        command: {
          contractVersion: "work-session-open.v1",
          workbenchCode: "product_selection",
          routeContext: { kind: "product_selection.v1", handoffId: HANDOFF_ID },
          subjectRef: { kind: "product_initiative_handoff", id: HANDOFF_ID },
          displaySummary: "选品",
          arbitrary: "forbidden",
        } as never,
      }),
    ).rejects.toThrow("VALIDATION_FORMAT: request");
  });
  it("rejects undeclared nested RouteContext keys", async () => {
    const repository = repositoryHarness();
    const service = new OpenWorkSessionService(repository);
    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        command: {
          contractVersion: "work-session-open.v1",
          workbenchCode: "product_selection",
          routeContext: {
            kind: "product_selection.v1",
            handoffId: HANDOFF_ID,
            freeUrl: "https://evil.example",
          },
          subjectRef: { kind: "product_initiative_handoff", id: HANDOFF_ID },
          displaySummary: "选品",
        } as never,
      }),
    ).rejects.toThrow("VALIDATION_FORMAT: routeContext");
  });
});

describe("ListWorkSessionsService", () => {
  it("keeps closed sessions excluded by default and includes them only when requested", async () => {
    const repository = repositoryHarness();
    vi.mocked(repository.list).mockResolvedValue([]);
    const service = new ListWorkSessionsService(repository);

    await service.execute({ tenantId: "tenant-1", actorId: "actor-1" });
    await service.execute({
      tenantId: "tenant-1",
      actorId: "actor-1",
      includeClosed: "true",
    });

    expect(repository.list).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ includeClosed: false }),
    );
    expect(repository.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ includeClosed: true }),
    );
  });

  it("rejects unknown includeClosed values", async () => {
    const service = new ListWorkSessionsService(repositoryHarness());
    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        includeClosed: "yes",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT: includeClosed");
  });
});

describe("UpdateWorkSessionService", () => {
  it("rejects an unknown status before persistence", async () => {
    const repository = repositoryHarness();
    const service = new UpdateWorkSessionService(repository);
    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        sessionId: EXISTING.sessionId,
        command: {
          contractVersion: "work-session-update.v1",
          expectedVersion: 4,
          status: "business_completed",
        } as never,
      }),
    ).rejects.toThrow("VALIDATION_FORMAT: status");
    expect(repository.updatePointer).not.toHaveBeenCalled();
  });

  it("rejects pointer updates for a closed session before persistence", async () => {
    const repository = repositoryHarness();
    vi.mocked(repository.findById).mockResolvedValue({
      ...EXISTING,
      status: "closed",
      version: 5,
    });
    const service = new UpdateWorkSessionService(repository);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        sessionId: EXISTING.sessionId,
        command: {
          contractVersion: "work-session-update.v1",
          expectedVersion: 5,
          status: "resumable",
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: "WORK_SESSION_CLOSED_TERMINAL",
    });
    expect(repository.updatePointer).not.toHaveBeenCalled();
  });
});

describe("CloseWorkSessionService", () => {
  it("rejects browser-held sessions before persistence", async () => {
    const repository = repositoryHarness();
    vi.mocked(repository.findById).mockResolvedValue({
      ...EXISTING,
      status: "browser_held",
    });
    const service = new CloseWorkSessionService(repository);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        sessionId: EXISTING.sessionId,
        command: {
          contractVersion: "work-session-close.v1",
          expectedVersion: EXISTING.version,
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: "WORK_SESSION_BROWSER_HELD_CLOSE_REQUIRES_ORIGINAL_TAB",
    });
    expect(repository.close).not.toHaveBeenCalled();
  });

  it("rejects an already closed session before persistence", async () => {
    const repository = repositoryHarness();
    vi.mocked(repository.findById).mockResolvedValue({
      ...EXISTING,
      status: "closed",
    });
    const service = new CloseWorkSessionService(repository);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        sessionId: EXISTING.sessionId,
        command: {
          contractVersion: "work-session-close.v1",
          expectedVersion: EXISTING.version,
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: "WORK_SESSION_CLOSED_TERMINAL",
    });
    expect(repository.close).not.toHaveBeenCalled();
  });
});

describe("ActivateWorkSessionService", () => {
  it("maps a stale session version to an HTTP conflict", async () => {
    const repository = repositoryHarness();
    vi.mocked(repository.activate).mockRejectedValue(
      new WorkSessionConflictError("WORK_SESSION_VERSION_CONFLICT"),
    );
    const service = new ActivateWorkSessionService(repository);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "actor-1",
        targetSessionId: "33333333-3333-4333-8333-333333333333",
        command: {
          contractVersion: "work-session-activate.v1",
          sourceSessionId: EXISTING.sessionId,
          expectedSourceSessionVersion: 3,
          expectedTargetSessionVersion: 1,
          sourceStatus: "resumable",
          domainVersionSeen: 0,
          sourceDomainVersionSeen: 0,
          sourceActiveItemKey: null,
          sourceContextMode: null,
        },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

function repositoryHarness() {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    openOrFocus: vi.fn(),
    updatePointer: vi.fn(),
    activate: vi.fn(),
    close: vi.fn(),
  } as unknown as WorkSessionRepository & {
    openOrFocus: ReturnType<typeof vi.fn>;
  };
}
