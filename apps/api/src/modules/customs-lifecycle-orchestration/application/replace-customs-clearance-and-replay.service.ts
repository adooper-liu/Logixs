import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  REPLACE_CUSTOMS_CLEARANCE_CASE,
  type ReplaceCustomsClearanceCaseCommand,
  type ReplaceCustomsClearanceCasePort,
} from "../../customs-compliance";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
  type ReplayPendingLifecycleDateFactsPort,
} from "../../lifecycle-control";

@Injectable()
export class ReplaceCustomsClearanceAndReplayService {
  private readonly logger = new Logger(
    ReplaceCustomsClearanceAndReplayService.name,
  );

  constructor(
    @Inject(REPLACE_CUSTOMS_CLEARANCE_CASE)
    private readonly replaceCase: ReplaceCustomsClearanceCasePort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(REPLAY_PENDING_LIFECYCLE_DATE_FACTS)
    private readonly replayPending: ReplayPendingLifecycleDateFactsPort,
  ) {}

  async execute(command: ReplaceCustomsClearanceCaseCommand) {
    if (command.evidenceRefs.length > 0) {
      await this.assertEvidenceRefs.execute({
        tenantId: command.tenantId,
        subjectType: "container",
        subjectId: command.containerRecordId,
        evidenceIds: command.evidenceRefs,
      });
    }
    const current = await this.replaceCase.execute(command);
    try {
      await this.replayPending.execute({
        tenantId: command.tenantId,
        containerId: command.containerRecordId,
      });
    } catch {
      this.logger.warn({
        event: "customs_clearance_pending_replay_failed",
        tenantId: command.tenantId,
        containerRecordId: command.containerRecordId,
        customsClearanceCaseId: current.caseId,
      });
      throw new HttpException(
        "SERVICE_UNAVAILABLE",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return current;
  }
}
