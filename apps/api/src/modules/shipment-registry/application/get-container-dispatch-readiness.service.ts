import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerDispatchReadinessResult,
  GetContainerDispatchReadinessPort,
} from "../get-container-dispatch-readiness.port";
import {
  CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY,
  type ContainerDispatchSnapshotRepository,
} from "../domain/container-dispatch-snapshot.repository";
import {
  CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
  type ContainerStuffingSnapshotRepository,
} from "../domain/container-stuffing-snapshot.repository";

@Injectable()
export class GetContainerDispatchReadinessService implements GetContainerDispatchReadinessPort {
  constructor(
    @Inject(CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY)
    private readonly dispatchRepository: ContainerDispatchSnapshotRepository,
    @Inject(CONTAINER_STUFFING_SNAPSHOT_REPOSITORY)
    private readonly stuffingRepository: ContainerStuffingSnapshotRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
    evidenceRefs: string[];
  }): Promise<ContainerDispatchReadinessResult> {
    const dispatch = await this.dispatchRepository.findCurrent(input);
    if (!dispatch) return pending("LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT");

    const stuffing = await this.stuffingRepository.findCurrent(input);
    if (
      !stuffing ||
      dispatch.stuffingSnapshotId !== stuffing.snapshotId ||
      dispatch.stuffingSnapshotVersion !== stuffing.version
    ) {
      return pending(
        "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT_STALE",
        dispatch.snapshotId,
      );
    }
    const linked = input.evidenceRefs.some((id) =>
      dispatch.evidenceRefs.includes(id),
    );
    if (!linked) {
      return pending(
        "LIFECYCLE_EVENT_PENDING_DISPATCH_EVIDENCE",
        dispatch.snapshotId,
      );
    }
    return {
      confirmed: true,
      reasonCode: null,
      snapshotId: dispatch.snapshotId,
    };
  }
}

function pending(
  reasonCode: Exclude<ContainerDispatchReadinessResult["reasonCode"], null>,
  snapshotId: string | null = null,
): ContainerDispatchReadinessResult {
  return { confirmed: false, reasonCode, snapshotId };
}
