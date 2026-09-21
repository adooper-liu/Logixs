import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { GetContainerCargoComplianceScopeService } from "./get-container-cargo-compliance-scope.service";
import { CONTAINER_STUFFING_SNAPSHOT_REPOSITORY } from "../domain/container-stuffing-snapshot.repository";
import { GetContainerStuffingReadinessService } from "./get-container-stuffing-readiness.service";

const evidenceId = "33333333-3333-4333-8333-333333333333";
const snapshot = {
  snapshotId: "44444444-4444-4444-8444-444444444444",
  allocationSetId: "22222222-2222-4222-8222-222222222222",
  allocationSetVersion: 3,
  evidenceRefs: [evidenceId],
};
const cargo = {
  allocationSetId: snapshot.allocationSetId,
  allocationSetVersion: snapshot.allocationSetVersion,
};

async function buildService(input?: {
  current?: typeof snapshot | null;
  cargo?: typeof cargo | null;
}) {
  const repository = {
    findCurrent: vi
      .fn()
      .mockResolvedValue(
        input && "current" in input ? input.current : snapshot,
      ),
  };
  const getCargo = {
    execute: vi
      .fn()
      .mockResolvedValue(input && "cargo" in input ? input.cargo : cargo),
  };
  const module = await Test.createTestingModule({
    providers: [
      GetContainerStuffingReadinessService,
      {
        provide: CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
        useValue: repository,
      },
      {
        provide: GetContainerCargoComplianceScopeService,
        useValue: getCargo,
      },
    ],
  }).compile();
  return module.get(GetContainerStuffingReadinessService);
}

describe("GetContainerStuffingReadinessService", () => {
  it("仅在快照匹配当前装载且事件引用装箱证据时确认", async () => {
    const service = await buildService();
    await expect(
      service.execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: [evidenceId],
      }),
    ).resolves.toEqual({
      confirmed: true,
      reasonCode: null,
      snapshotId: snapshot.snapshotId,
    });
  });

  it("分别识别缺快照、装载已变化和证据未关联", async () => {
    const missing = await buildService({ current: null });
    await expect(
      missing.execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: [evidenceId],
      }),
    ).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT",
    });

    const stale = await buildService({
      cargo: { ...cargo, allocationSetVersion: 4 },
    });
    await expect(
      stale.execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: [evidenceId],
      }),
    ).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT_STALE",
    });

    const unlinked = await buildService();
    await expect(
      unlinked.execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
      }),
    ).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_PENDING_STUFFING_EVIDENCE",
    });
  });
});
