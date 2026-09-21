import { describe, expect, it } from "vitest";
import {
  ContainerStuffingSnapshotValidationError,
  normalizeContainerStuffingSnapshotCommand,
} from "./container-stuffing-snapshot";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  allocationSetId: "22222222-2222-4222-8222-222222222222",
  allocationSetVersion: 3,
  containerNumber: "KOCU4960726",
  sealNumber: "25H1059249",
  packageCount: 524,
  grossWeight: "8319.000",
  grossWeightUnit: "KGM" as const,
  netWeight: "8000.5",
  volume: "66.740",
  volumeUnit: "MTQ" as const,
  vgm: {
    weight: "8500.000",
    weightUnit: "KGM" as const,
    method: "method_2" as const,
    verifiedAt: "2026-01-23T09:15:00+08:00",
  },
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "stuffing_confirmed",
  idempotencyKey: "stuffing:container-1:v1",
};

describe("container stuffing snapshot command", () => {
  it("规范单位、定点数和 VGM UTC 时间并生成稳定载荷哈希", () => {
    const normalized = normalizeContainerStuffingSnapshotCommand(command);
    const replay = normalizeContainerStuffingSnapshotCommand(command);

    expect(normalized.grossWeight).toBe("8319");
    expect(normalized.netWeight).toBe("8000.5");
    expect(normalized.volume).toBe("66.74");
    expect(normalized.vgm).toEqual({
      weight: "8500",
      weightUnit: "KGM",
      method: "method_2",
      verifiedAt: "2026-01-23T01:15:00.000Z",
    });
    expect(normalized.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(replay.payloadHash).toBe(normalized.payloadHash);
  });

  it.each([
    ["箱号校验位错误", { ...command, containerNumber: "KOCU4960725" }],
    ["包装数必须为正整数", { ...command, packageCount: 0 }],
    ["重量最多三位小数", { ...command, grossWeight: "8319.0001" }],
    ["净重不得大于毛重", { ...command, netWeight: "9000" }],
    [
      "VGM 不得小于毛重",
      { ...command, vgm: { ...command.vgm, weight: "8000" } },
    ],
    [
      "VGM 时间必须带时区",
      {
        ...command,
        vgm: { ...command.vgm, verifiedAt: "2026-01-23T09:15:00" },
      },
    ],
    ["证据不得为空", { ...command, evidenceRefs: [] }],
    [
      "证据不得重复",
      {
        ...command,
        evidenceRefs: [command.evidenceRefs[0]!, command.evidenceRefs[0]!],
      },
    ],
    ["版本不得为负", { ...command, expectedVersion: -1 }],
  ])("拒绝%s", (_label, input) => {
    expect(() => normalizeContainerStuffingSnapshotCommand(input)).toThrow(
      ContainerStuffingSnapshotValidationError,
    );
  });

  it("允许装箱时暂未形成 VGM，但保持显式 null", () => {
    const normalized = normalizeContainerStuffingSnapshotCommand({
      ...command,
      vgm: null,
    });

    expect(normalized.vgm).toBeNull();
  });
});
