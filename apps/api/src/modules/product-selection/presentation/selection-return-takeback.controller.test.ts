import { describe, expect, it, vi } from "vitest";
import { SelectionReturnTakebackController } from "./selection-return-takeback.controller";

describe("SelectionReturnTakebackController", () => {
  it("rejects an invalid signal id before calling the use case", () => {
    const takeBack = { execute: vi.fn() };
    const controller = new SelectionReturnTakebackController(takeBack as never);

    expect(() =>
      controller.execute(
        { identity: { tenantId: "tenant-a", actorId: "market-owner" } },
        "not-a-uuid",
        {
          contractVersion: "market-selection-return-takeback.v1",
          expectedSignalVersion: 3,
          idempotencyKey: "takeback-1",
        },
      ),
    ).toThrow("VALIDATION_FORMAT: signalId");
    expect(takeBack.execute).not.toHaveBeenCalled();
  });

  it("normalizes a valid signal id and forwards authenticated identity", () => {
    const takeBack = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new SelectionReturnTakebackController(takeBack as never);
    const signalId = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const command = {
      contractVersion: "market-selection-return-takeback.v1" as const,
      expectedSignalVersion: 3,
      idempotencyKey: "takeback-1",
    };

    controller.execute(
      { identity: { tenantId: "tenant-a", actorId: "market-owner" } },
      signalId,
      command,
    );

    expect(takeBack.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "market-owner",
      signalId: signalId.toLowerCase(),
      command,
    });
  });
});
