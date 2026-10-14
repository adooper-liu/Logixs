import { describe, expect, it, vi } from "vitest";
import { WorkSessionConflictError } from "../domain/work-session";
import type {
  WorkSessionRecord,
  WorkSessionRepository,
} from "../domain/work-session.repository";
import { ActivateWorkSessionService } from "./activate-work-session.service";
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
