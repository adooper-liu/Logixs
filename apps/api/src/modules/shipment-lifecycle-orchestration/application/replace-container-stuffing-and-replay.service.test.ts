import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "../../lifecycle-control";
import { REPLACE_CONTAINER_STUFFING_SNAPSHOT } from "../../shipment-registry";
import { ReplaceContainerStuffingAndReplayService } from "./replace-container-stuffing-and-replay.service";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  allocationSetId: "22222222-2222-4222-8222-222222222222",
  allocationSetVersion: 3,
  containerNumber: "KOCU4960726",
  sealNumber: "25H1059249",
  packageCount: 524,
  grossWeight: "8319",
  grossWeightUnit: "KGM" as const,
  netWeight: "8000",
  volume: "66.74",
  volumeUnit: "MTQ" as const,
  vgm: null,
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "stuffing_confirmed",
  idempotencyKey: "stuffing:container-1:v1",
};

async function buildService(options?: {
  evidenceFails?: boolean;
  replayFails?: boolean;
}) {
  const replaceSnapshot = {
    execute: vi.fn().mockResolvedValue({ snapshotId: "snapshot-1" }),
  };
  const assertEvidenceRefs = {
    execute: options?.evidenceFails
      ? vi.fn().mockRejectedValue(new HttpException("EVIDENCE_REQUIRED", 422))
      : vi.fn().mockResolvedValue(undefined),
  };
  const replayPending = {
    execute: options?.replayFails
      ? vi.fn().mockRejectedValue(new Error("temporarily unavailable"))
      : vi.fn().mockResolvedValue({
          claimed: 1,
          applied: 1,
          pending: 0,
          rejected: 0,
        }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceContainerStuffingAndReplayService,
      {
        provide: REPLACE_CONTAINER_STUFFING_SNAPSHOT,
        useValue: replaceSnapshot,
      },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
      { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replayPending },
    ],
  }).compile();
  return {
    service: module.get(ReplaceContainerStuffingAndReplayService),
    replaceSnapshot,
    assertEvidenceRefs,
    replayPending,
  };
}

describe("ReplaceContainerStuffingAndReplayService", () => {
  it("先核验本柜证据，再保存快照并自动重放待处理日期事实", async () => {
    const context = await buildService();

    await expect(context.service.execute(command)).resolves.toEqual({
      snapshotId: "snapshot-1",
    });
    expect(context.assertEvidenceRefs.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      subjectType: "container",
      subjectId: command.containerRecordId,
      evidenceIds: command.evidenceRefs,
    });
    expect(context.replaceSnapshot.execute).toHaveBeenCalledWith(command);
    expect(context.replayPending.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerRecordId,
    });
  });

  it("证据不合格时不保存快照，也不重放", async () => {
    const context = await buildService({ evidenceFails: true });

    await expect(context.service.execute(command)).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
    expect(context.replaceSnapshot.execute).not.toHaveBeenCalled();
    expect(context.replayPending.execute).not.toHaveBeenCalled();
  });

  it("非法输入在查询证据前明确返回 400", async () => {
    const context = await buildService();

    await expect(
      context.service.execute({ ...command, containerNumber: "bad-number" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(context.assertEvidenceRefs.execute).not.toHaveBeenCalled();
    expect(context.replaceSnapshot.execute).not.toHaveBeenCalled();
  });

  it("快照已保存但重放失败时返回可重试错误，同一幂等键可再次调用", async () => {
    const context = await buildService({ replayFails: true });

    await expect(context.service.execute(command)).rejects.toMatchObject({
      message: "SERVICE_UNAVAILABLE",
    });
    expect(context.replaceSnapshot.execute).toHaveBeenCalledWith(command);
  });
});
