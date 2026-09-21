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
  ContainerDispatchSnapshotValidationError,
  normalizeContainerDispatchSnapshotCommand,
  REPLACE_CONTAINER_DISPATCH_SNAPSHOT,
  type ContainerDispatchSnapshotRecord,
  type ReplaceContainerDispatchSnapshotCommand,
  type ReplaceContainerDispatchSnapshotPort,
} from "../../shipment-registry";

@Injectable()
export class ReplaceContainerDispatchAndReplayService {
  private readonly logger = new Logger(
    ReplaceContainerDispatchAndReplayService.name,
  );

  constructor(
    @Inject(REPLACE_CONTAINER_DISPATCH_SNAPSHOT)
    private readonly replaceSnapshot: ReplaceContainerDispatchSnapshotPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(REPLAY_PENDING_LIFECYCLE_DATE_FACTS)
    private readonly replayPending: ReplayPendingLifecycleDateFactsPort,
  ) {}

  async execute(
    command: ReplaceContainerDispatchSnapshotCommand,
  ): Promise<ContainerDispatchSnapshotRecord> {
    let normalized;
    try {
      normalized = normalizeContainerDispatchSnapshotCommand(command);
    } catch (error) {
      if (error instanceof ContainerDispatchSnapshotValidationError) {
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
        event: "container_dispatch_pending_replay_failed",
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
