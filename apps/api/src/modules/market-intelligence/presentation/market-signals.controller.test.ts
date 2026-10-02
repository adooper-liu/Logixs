import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { MarketSignalsController } from "./market-signals.controller";

function setup() {
  const create = { execute: vi.fn() };
  const list = { execute: vi.fn().mockResolvedValue({ items: [] }) };
  const update = { execute: vi.fn() };
  const decide = { execute: vi.fn().mockResolvedValue({ status: "saved" }) };
  const get = { execute: vi.fn() };
  return {
    create,
    list,
    update,
    decide,
    get,
    controller: new MarketSignalsController(
      create as never,
      list as never,
      update as never,
      decide as never,
      get as never,
    ),
  };
}

describe("MarketSignalsController", () => {
  it("keeps existing read and draft capabilities", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        MarketSignalsController.prototype.list,
      ),
    ).toEqual(["planning.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        MarketSignalsController.prototype.decide,
      ),
    ).toEqual(["planning.draft"]);
  });

  it("forwards identity tenant and destination to list", async () => {
    const { controller, list } = setup();
    await controller.list(
      { identity: { tenantId: "tenant-a", actorId: "actor-a" } },
      "watching",
      "50",
      "cursor-a",
    );
    expect(list.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      destination: "watching",
      pageSize: "50",
      cursor: "cursor-a",
    });
  });

  it("binds decision ownership to the authenticated actor", async () => {
    const { controller, decide } = setup();
    const body = {
      contractVersion: "market-signal-decision.v1" as const,
      expectedSignalVersion: 1,
      decisionType: "watch" as const,
      nextReviewDate: "2026-02-12",
      watchFocus: "确认趋势持续性",
      idempotencyKey: "watch-1",
    };
    await controller.decide(
      { identity: { tenantId: "tenant-a", actorId: "actor-a" } },
      "signal-a",
      body,
    );
    expect(decide.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "actor-a",
      signalId: "signal-a",
      command: body,
    });
  });
});
