import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION } from "../../inland-fulfillment";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "../../lifecycle-control";
import { ReplaceWarehouseDeliveryInstructionAndReplayService } from "./replace-warehouse-delivery-instruction-and-replay.service";

const command = {
  tenantId: "dev-tenant",
  containerRecordId: "22222222-2222-4222-8222-222222222222",
  expectedVersion: 0,
  warehouseLocationId: "33333333-3333-4333-8333-333333333333",
  warehouseCode: "VLS",
  warehouseName: "Barcelona VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
  actorId: "dev-operator",
  reasonCode: "delivery_instruction_confirmed",
  idempotencyKey: "delivery-instruction-1",
};

async function context(replayFails = false) {
  const replace = {
    execute: vi.fn().mockResolvedValue({ instructionId: "instruction-1" }),
  };
  const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
  const replay = {
    execute: replayFails
      ? vi.fn().mockRejectedValue(new Error("down"))
      : vi.fn().mockResolvedValue({ applied: 1 }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceWarehouseDeliveryInstructionAndReplayService,
      { provide: REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION, useValue: replace },
      { provide: ASSERT_EVIDENCE_REFS, useValue: evidence },
      { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replay },
    ],
  }).compile();
  return {
    service: module.get(ReplaceWarehouseDeliveryInstructionAndReplayService),
    replace,
    evidence,
    replay,
  };
}

describe("ReplaceWarehouseDeliveryInstructionAndReplayService", () => {
  it("qualifies evidence before replacing the instruction and replays pending facts", async () => {
    const value = await context();
    await expect(value.service.execute(command)).resolves.toEqual({
      instructionId: "instruction-1",
    });
    expect(value.evidence.execute.mock.invocationCallOrder[0]).toBeLessThan(
      value.replace.execute.mock.invocationCallOrder[0]!,
    );
    expect(value.replay.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerRecordId,
    });
  });

  it("returns a retryable boundary error after a committed instruction when replay fails", async () => {
    const value = await context(true);
    await expect(value.service.execute(command)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(value.replace.execute).toHaveBeenCalledOnce();
  });
});
