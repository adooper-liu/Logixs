import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY } from "../domain/container-dispatch-snapshot.repository";
import { CONTAINER_STUFFING_SNAPSHOT_REPOSITORY } from "../domain/container-stuffing-snapshot.repository";
import { GetContainerDispatchReadinessService } from "./get-container-dispatch-readiness.service";

const evidenceId = "33333333-3333-4333-8333-333333333333";
const dispatch = {
  snapshotId: "44444444-4444-4444-8444-444444444444",
  stuffingSnapshotId: "55555555-5555-4555-8555-555555555555",
  stuffingSnapshotVersion: 2,
  evidenceRefs: [evidenceId],
};
const stuffing = { snapshotId: dispatch.stuffingSnapshotId, version: 2 };

async function service(input?: {
  dispatch?: typeof dispatch | null;
  stuffing?: typeof stuffing | null;
}) {
  const module = await Test.createTestingModule({
    providers: [
      GetContainerDispatchReadinessService,
      {
        provide: CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY,
        useValue: {
          findCurrent: vi
            .fn()
            .mockResolvedValue(
              input && "dispatch" in input ? input.dispatch : dispatch,
            ),
        },
      },
      {
        provide: CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
        useValue: {
          findCurrent: vi
            .fn()
            .mockResolvedValue(
              input && "stuffing" in input ? input.stuffing : stuffing,
            ),
        },
      },
    ],
  }).compile();
  return module.get(GetContainerDispatchReadinessService);
}

describe("GetContainerDispatchReadinessService", () => {
  it("confirms only current stuffing and linked evidence", async () => {
    await expect(
      (await service()).execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: [evidenceId],
      }),
    ).resolves.toEqual({
      confirmed: true,
      reasonCode: null,
      snapshotId: dispatch.snapshotId,
    });
  });

  it.each([
    [null, stuffing, "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT"],
    [
      dispatch,
      { ...stuffing, version: 3 },
      "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT_STALE",
    ],
  ])(
    "reports missing or stale dispatch readiness",
    async (dispatchValue, stuffingValue, reasonCode) => {
      const value = await service({
        dispatch: dispatchValue,
        stuffing: stuffingValue,
      });
      await expect(
        value.execute({
          tenantId: "tenant-a",
          containerRecordId: "container-1",
          evidenceRefs: [evidenceId],
        }),
      ).resolves.toMatchObject({ confirmed: false, reasonCode });
    },
  );

  it("requires loaded evidence to be linked to the dispatch snapshot", async () => {
    await expect(
      (await service()).execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: ["66666666-6666-4666-8666-666666666666"],
      }),
    ).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_PENDING_DISPATCH_EVIDENCE",
    });
  });
});
