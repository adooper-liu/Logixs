import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { ActivateWorkSessionService } from "../application/activate-work-session.service";
import type { CloseWorkSessionService } from "../application/close-work-session.service";
import type { ListWorkSessionsService } from "../application/list-work-sessions.service";
import type { OpenWorkSessionService } from "../application/open-work-session.service";
import type { UpdateWorkSessionService } from "../application/update-work-session.service";
import { WorkSessionsController } from "./work-sessions.controller";
import type { WorkSessionOpenRequestDto } from "./work-session.dto";

const OPEN: WorkSessionOpenRequestDto = {
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
  displaySummary: "选品 · 加拿大户外储物柜",
};

describe("WorkSessionsController", () => {
  it("requires owner-scoped work session capability on every endpoint", () => {
    for (const method of [
      "list",
      "open",
      "update",
      "activate",
      "close",
    ] as const) {
      expect(
        Reflect.getMetadata(
          REQUIRED_CAPABILITIES_KEY,
          WorkSessionsController.prototype[method],
        ),
      ).toEqual(["work_session.manage"]);
    }
  });

  it("binds tenant and actor from authenticated identity", async () => {
    const open = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new WorkSessionsController(
      {} as ListWorkSessionsService,
      open as unknown as OpenWorkSessionService,
      {} as UpdateWorkSessionService,
      {} as ActivateWorkSessionService,
      {} as CloseWorkSessionService,
    );

    await controller.open(OPEN, {
      identity: { tenantId: "tenant-1", actorId: "actor-1" },
    });

    expect(open.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "actor-1",
      command: OPEN,
    });
  });

  it("forwards the explicit closed-session query without changing the owner scope", async () => {
    const list = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const controller = new WorkSessionsController(
      list as unknown as ListWorkSessionsService,
      {} as OpenWorkSessionService,
      {} as UpdateWorkSessionService,
      {} as ActivateWorkSessionService,
      {} as CloseWorkSessionService,
    );

    await controller.list(
      { identity: { tenantId: "tenant-1", actorId: "actor-1" } },
      "50",
      undefined,
      "true",
    );

    expect(list.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "actor-1",
      pageSize: "50",
      cursor: undefined,
      includeClosed: "true",
    });
  });
});
