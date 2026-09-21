import { describe, expect, it } from "vitest";
import {
  ContainerDispatchSnapshotValidationError,
  normalizeContainerDispatchSnapshotCommand,
  type ReplaceContainerDispatchSnapshotCommand,
} from "./container-dispatch-snapshot";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  stuffingSnapshotId: "22222222-2222-4222-8222-222222222222",
  stuffingSnapshotVersion: 2,
  bookingNumber: "BKG-2026-001",
  carrierCode: "HMM",
  vesselName: "HMM LEAF",
  voyageNumber: "0002W",
  masterBillNumber: null,
  houseBillNumber: null,
  vgmHandoffState: "accepted" as const,
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "dispatch_confirmed",
  idempotencyKey: "dispatch:container-1:v1",
};

describe("container dispatch snapshot command", () => {
  it("normalizes transport references and creates a stable payload hash", () => {
    const normalized = normalizeContainerDispatchSnapshotCommand(command);

    expect(normalized.carrierCode).toBe("HMM");
    expect(normalized.masterBillNumber).toBeNull();
    expect(normalized.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(normalizeContainerDispatchSnapshotCommand(command).payloadHash).toBe(
      normalized.payloadHash,
    );
  });

  it.each([
    ["booking is required", { ...command, bookingNumber: "" }],
    ["vessel is required", { ...command, vesselName: " " }],
    ["voyage is required", { ...command, voyageNumber: "" }],
    ["accepted VGM is required", { ...command, vgmHandoffState: "submitted" }],
    ["evidence is required", { ...command, evidenceRefs: [] }],
    ["version cannot be negative", { ...command, expectedVersion: -1 }],
  ])("rejects invalid input: %s", (_label, input) => {
    expect(() =>
      normalizeContainerDispatchSnapshotCommand(
        input as ReplaceContainerDispatchSnapshotCommand,
      ),
    ).toThrow(ContainerDispatchSnapshotValidationError);
  });

  it("accepts optional master and house bill references", () => {
    const normalized = normalizeContainerDispatchSnapshotCommand({
      ...command,
      masterBillNumber: "NBOZ6N378300",
      houseBillNumber: "HBL-001",
    });

    expect(normalized.masterBillNumber).toBe("NBOZ6N378300");
    expect(normalized.houseBillNumber).toBe("HBL-001");
  });
});
