import { describe, expect, it } from "vitest";
import {
  ContainerCargoAllocationValidationError,
  normalizeReplaceContainerCargoAllocationsCommand,
  quantityToScaledInteger,
} from "./container-cargo-allocation";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix-web",
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "cargo:container-1:v1",
  allocations: [
    {
      replenishmentOrderLineId: "33333333-3333-4333-8333-333333333333",
      allocatedQuantity: "10.500",
      quantityUnit: "piece" as const,
    },
  ],
};

describe("container cargo allocation command", () => {
  it("规范定点数量并生成稳定载荷哈希", () => {
    const normalized =
      normalizeReplaceContainerCargoAllocationsCommand(command);
    const replay = normalizeReplaceContainerCargoAllocationsCommand(command);

    expect(normalized.allocations[0]?.allocatedQuantity).toBe("10.5");
    expect(normalized.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(replay.payloadHash).toBe(normalized.payloadHash);
    expect(quantityToScaledInteger("10.5")).toBe(10500n);
  });

  it.each([
    { ...command, expectedVersion: -1 },
    { ...command, evidenceRefs: [] },
    { ...command, allocations: [] },
    {
      ...command,
      allocations: [{ ...command.allocations[0]!, allocatedQuantity: "0" }],
    },
    {
      ...command,
      allocations: [
        { ...command.allocations[0]!, allocatedQuantity: "1.0001" },
      ],
    },
    {
      ...command,
      allocations: [command.allocations[0]!, command.allocations[0]!],
    },
  ])("拒绝非法装载命令", (input) => {
    expect(() =>
      normalizeReplaceContainerCargoAllocationsCommand(input),
    ).toThrow(ContainerCargoAllocationValidationError);
  });
});
