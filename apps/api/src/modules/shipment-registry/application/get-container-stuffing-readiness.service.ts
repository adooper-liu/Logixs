import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerStuffingReadinessResult,
  GetContainerStuffingReadinessPort,
} from "../get-container-stuffing-readiness.port";
import {
  CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
  type ContainerStuffingSnapshotRepository,
} from "../domain/container-stuffing-snapshot.repository";
import { GetContainerCargoComplianceScopeService } from "./get-container-cargo-compliance-scope.service";

@Injectable()
export class GetContainerStuffingReadinessService implements GetContainerStuffingReadinessPort {
  constructor(
    @Inject(CONTAINER_STUFFING_SNAPSHOT_REPOSITORY)
    private readonly repository: ContainerStuffingSnapshotRepository,
    @Inject(GetContainerCargoComplianceScopeService)
    private readonly getCargo: GetContainerCargoComplianceScopeService,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
    evidenceRefs: string[];
  }): Promise<ContainerStuffingReadinessResult> {
    const [snapshot, cargo] = await Promise.all([
      this.repository.findCurrent(input),
      this.getCargo.execute(input),
    ]);
    if (!snapshot) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT",
        snapshotId: null,
      };
    }
    if (
      !cargo ||
      cargo.allocationSetId !== snapshot.allocationSetId ||
      cargo.allocationSetVersion !== snapshot.allocationSetVersion
    ) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT_STALE",
        snapshotId: snapshot.snapshotId,
      };
    }
    const evidenceRefs = new Set(input.evidenceRefs);
    if (
      !snapshot.evidenceRefs.every((reference) => evidenceRefs.has(reference))
    ) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_STUFFING_EVIDENCE",
        snapshotId: snapshot.snapshotId,
      };
    }
    return {
      confirmed: true,
      reasonCode: null,
      snapshotId: snapshot.snapshotId,
    };
  }
}
