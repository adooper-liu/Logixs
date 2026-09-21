import { describe, expect, it } from "vitest";
import {
  ContainerUnloadingReportConflictError,
  ContainerUnloadingReportValidationError,
  assertUnloadingStateProgression,
  normalizeContainerUnloadingReportCommand,
} from "./container-unloading-report";

const base = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 1,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  operationState: "partial" as const,
  startedAt: "2026-04-23T08:00:00+02:00",
  completedAt: null,
  expectedQuantity: "524",
  unloadedQuantity: "300",
  remainingQuantity: "220",
  damagedQuantity: "2",
  shortageQuantity: "4",
  quantityUnit: "carton" as const,
  sealCheck: "mismatch" as const,
  exceptionResolved: false,
  exceptionNotes: "封号不一致，已通知收货主管复核",
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "warehouse-operator",
  reasonCode: "unloading_progress_reported",
  idempotencyKey: "unloading-v2",
};

describe("normalizeContainerUnloadingReportCommand", () => {
  it("normalizes a balanced partial unloading report", () => {
    const result = normalizeContainerUnloadingReportCommand(base);
    expect(result).toMatchObject({
      unloadedQuantity: "300",
      remainingQuantity: "220",
      shortageQuantity: "4",
      operationState: "partial",
    });
    expect(result.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects quantity imbalance and partial reports with no remaining cargo", () => {
    expect(() =>
      normalizeContainerUnloadingReportCommand({
        ...base,
        remainingQuantity: "219",
      }),
    ).toThrow(ContainerUnloadingReportValidationError);
    expect(() =>
      normalizeContainerUnloadingReportCommand({
        ...base,
        unloadedQuantity: "520",
        remainingQuantity: "0",
      }),
    ).toThrow(ContainerUnloadingReportValidationError);
  });

  it("requires completion time, zero remaining cargo and resolved exceptions", () => {
    expect(() =>
      normalizeContainerUnloadingReportCommand({
        ...base,
        expectedVersion: 2,
        operationState: "completed",
        unloadedQuantity: "520",
        remainingQuantity: "0",
        completedAt: "2026-04-23T10:30:00+02:00",
      }),
    ).toThrow(ContainerUnloadingReportValidationError);

    expect(
      normalizeContainerUnloadingReportCommand({
        ...base,
        expectedVersion: 2,
        operationState: "completed",
        unloadedQuantity: "520",
        remainingQuantity: "0",
        completedAt: "2026-04-23T10:30:00+02:00",
        exceptionResolved: true,
      }).operationState,
    ).toBe("completed");
  });
});

describe("assertUnloadingStateProgression", () => {
  it("allows forward progress and completed corrections", () => {
    expect(() =>
      assertUnloadingStateProgression("started", "partial"),
    ).not.toThrow();
    expect(() =>
      assertUnloadingStateProgression("partial", "completed"),
    ).not.toThrow();
    expect(() =>
      assertUnloadingStateProgression("completed", "completed"),
    ).not.toThrow();
  });

  it("rejects state regression", () => {
    expect(() => assertUnloadingStateProgression("partial", "started")).toThrow(
      ContainerUnloadingReportConflictError,
    );
  });
});
