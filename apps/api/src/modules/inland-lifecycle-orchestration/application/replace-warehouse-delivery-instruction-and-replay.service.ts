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
  REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION,
  type ReplaceWarehouseDeliveryInstructionCommand,
  type ReplaceWarehouseDeliveryInstructionPort,
} from "../../inland-fulfillment";
import {
  REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
  type ReplayPendingLifecycleDateFactsPort,
} from "../../lifecycle-control";

@Injectable()
export class ReplaceWarehouseDeliveryInstructionAndReplayService {
  private readonly logger = new Logger(
    ReplaceWarehouseDeliveryInstructionAndReplayService.name,
  );

  constructor(
    @Inject(REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION)
    private readonly replaceInstruction: ReplaceWarehouseDeliveryInstructionPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(REPLAY_PENDING_LIFECYCLE_DATE_FACTS)
    private readonly replayPending: ReplayPendingLifecycleDateFactsPort,
  ) {}

  async execute(command: ReplaceWarehouseDeliveryInstructionCommand) {
    await this.assertEvidenceRefs.execute({
      tenantId: command.tenantId,
      subjectType: "container",
      subjectId: command.containerRecordId,
      evidenceIds: command.evidenceRefs,
    });
    const instruction = await this.replaceInstruction.execute(command);
    try {
      await this.replayPending.execute({
        tenantId: command.tenantId,
        containerId: command.containerRecordId,
      });
    } catch {
      this.logger.warn({
        event: "warehouse_delivery_pending_replay_failed",
        tenantId: command.tenantId,
        containerRecordId: command.containerRecordId,
        instructionId: instruction.instructionId,
      });
      throw new HttpException(
        "SERVICE_UNAVAILABLE",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return instruction;
  }
}
