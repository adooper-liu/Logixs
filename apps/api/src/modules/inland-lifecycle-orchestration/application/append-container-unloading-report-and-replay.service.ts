import {
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
  APPEND_CONTAINER_UNLOADING_REPORT,
  type AppendContainerUnloadingReportCommand,
  type AppendContainerUnloadingReportPort,
} from "../../inland-fulfillment";
import {
  REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
  type ReplayPendingLifecycleDateFactsPort,
} from "../../lifecycle-control";

@Injectable()
export class AppendContainerUnloadingReportAndReplayService {
  private readonly logger = new Logger(
    AppendContainerUnloadingReportAndReplayService.name,
  );

  constructor(
    @Inject(APPEND_CONTAINER_UNLOADING_REPORT)
    private readonly appendReport: AppendContainerUnloadingReportPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(REPLAY_PENDING_LIFECYCLE_DATE_FACTS)
    private readonly replayPending: ReplayPendingLifecycleDateFactsPort,
  ) {}

  async execute(command: AppendContainerUnloadingReportCommand) {
    await this.assertEvidenceRefs.execute({
      tenantId: command.tenantId,
      subjectType: "container",
      subjectId: command.containerRecordId,
      evidenceIds: command.evidenceRefs,
    });
    const report = await this.appendReport.execute(command);
    try {
      await this.replayPending.execute({
        tenantId: command.tenantId,
        containerId: command.containerRecordId,
      });
    } catch {
      this.logger.warn({
        event: "container_unloading_pending_replay_failed",
        tenantId: command.tenantId,
        containerRecordId: command.containerRecordId,
        reportId: report.reportId,
      });
      throw new HttpException(
        "SERVICE_UNAVAILABLE",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return report;
  }
}
