import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
  type ReplayPendingLifecycleDateFactsPort,
} from "../../lifecycle-control";
import {
  ContainerStuffingSnapshotValidationError,
  normalizeContainerStuffingSnapshotCommand,
  REPLACE_CONTAINER_STUFFING_SNAPSHOT,
  type ContainerStuffingSnapshotRecord,
  type ReplaceContainerStuffingSnapshotCommand,
  type ReplaceContainerStuffingSnapshotPort,
} from "../../shipment-registry";

@Injectable()
export class ReplaceContainerStuffingAndReplayService {
  private readonly logger = new Logger(
    ReplaceContainerStuffingAndReplayService.name,
  );

  constructor(
    @Inject(REPLACE_CONTAINER_STUFFING_SNAPSHOT)
    private readonly replaceSnapshot: ReplaceContainerStuffingSnapshotPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(REPLAY_PENDING_LIFECYCLE_DATE_FACTS)
    private readonly replayPending: ReplayPendingLifecycleDateFactsPort,
  ) {}

  async execute(
    command: ReplaceContainerStuffingSnapshotCommand,
  ): Promise<ContainerStuffingSnapshotRecord> {
    let normalized;
    try {
      normalized = normalizeContainerStuffingSnapshotCommand(command);
    } catch (error) {
      if (error instanceof ContainerStuffingSnapshotValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await this.assertEvidenceRefs.execute({
      tenantId: normalized.tenantId,
      subjectType: "container",
      subjectId: normalized.containerRecordId,
      evidenceIds: normalized.evidenceRefs,
    });
    const snapshot = await this.replaceSnapshot.execute(command);
    try {
      await this.replayPending.execute({
        tenantId: normalized.tenantId,
        containerId: normalized.containerRecordId,
      });
    } catch {
      this.logger.warn({
        event: "container_stuffing_pending_replay_failed",
        tenantId: normalized.tenantId,
        containerRecordId: normalized.containerRecordId,
        snapshotId: snapshot.snapshotId,
      });
      throw new HttpException(
        "SERVICE_UNAVAILABLE",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return snapshot;
  }
}
