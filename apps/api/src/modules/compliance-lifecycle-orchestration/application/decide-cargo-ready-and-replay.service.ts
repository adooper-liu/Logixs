import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DECIDE_CARGO_READY_COMPLIANCE,
  type DecideCargoReadyComplianceCommand,
  type DecideCargoReadyCompliancePort,
} from "../../compliance-management";
import {
  REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
  type ReplayPendingLifecycleDateFactsPort,
} from "../../lifecycle-control";

export type CargoReadyDecisionCode =
  DecideCargoReadyComplianceCommand["decisionCode"];

export type ComplianceReplayStatus =
  | "not_requested"
  | "no_pending_facts"
  | "completed"
  | "deferred"
  | "retry_required";

export interface ComplianceReplayResult {
  status: ComplianceReplayStatus;
  reasonCode:
    | "DECISION_DOES_NOT_ALLOW_PROGRESS"
    | "NO_PENDING_FACTS"
    | "REPLAY_COMPLETED"
    | "FACTS_REMAIN_PENDING"
    | "REPLAY_REQUEST_FAILED";
  claimed: number;
  applied: number;
  pending: number;
  rejected: number;
}

@Injectable()
export class DecideCargoReadyAndReplayService {
  private readonly logger = new Logger(DecideCargoReadyAndReplayService.name);

  constructor(
    @Inject(DECIDE_CARGO_READY_COMPLIANCE)
    private readonly decide: DecideCargoReadyCompliancePort,
    @Inject(REPLAY_PENDING_LIFECYCLE_DATE_FACTS)
    private readonly replayPending: ReplayPendingLifecycleDateFactsPort,
  ) {}

  async execute(command: DecideCargoReadyComplianceCommand) {
    const decision = await this.decide.execute(command);
    if (
      !["approved", "approved_with_conditions"].includes(
        decision.record.currentDecision?.decisionCode ?? "",
      )
    ) {
      return {
        ...decision,
        replay: emptyReplay(
          "not_requested",
          "DECISION_DOES_NOT_ALLOW_PROGRESS",
        ),
      };
    }

    try {
      const replay = await this.replayPending.execute({
        tenantId: command.tenantId,
        containerId: command.containerRecordId,
      });
      if (replay.claimed === 0) {
        return {
          ...decision,
          replay: {
            ...replay,
            status: "no_pending_facts" as const,
            reasonCode: "NO_PENDING_FACTS" as const,
          },
        };
      }
      const deferred = replay.pending > 0 || replay.rejected > 0;
      return {
        ...decision,
        replay: {
          ...replay,
          status: deferred ? ("deferred" as const) : ("completed" as const),
          reasonCode: deferred
            ? ("FACTS_REMAIN_PENDING" as const)
            : ("REPLAY_COMPLETED" as const),
        },
      };
    } catch {
      this.logger.warn({
        event: "cargo_ready_compliance_replay_failed",
        tenantId: command.tenantId,
        containerRecordId: command.containerRecordId,
        assessmentId: command.assessmentId,
      });
      return {
        ...decision,
        replay: emptyReplay("retry_required", "REPLAY_REQUEST_FAILED"),
      };
    }
  }
}

function emptyReplay(
  status: Extract<ComplianceReplayStatus, "not_requested" | "retry_required">,
  reasonCode: Extract<
    ComplianceReplayResult["reasonCode"],
    "DECISION_DOES_NOT_ALLOW_PROGRESS" | "REPLAY_REQUEST_FAILED"
  >,
): ComplianceReplayResult {
  return {
    status,
    reasonCode,
    claimed: 0,
    applied: 0,
    pending: 0,
    rejected: 0,
  };
}
