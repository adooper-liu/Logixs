import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  APPLY_LIFECYCLE_EVENT_ONCE,
  type ApplyLifecycleEventOncePort,
} from "../apply-lifecycle-event-once.port";
import { classifyLifecycleApplicationFailure } from "./lifecycle-application-failure";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
import type {
  ReplayPendingLifecycleDateFactsInput,
  ReplayPendingLifecycleDateFactsPort,
  ReplayPendingLifecycleDateFactsResult,
} from "../replay-pending-lifecycle-date-facts.port";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const LEASE_MILLISECONDS = 30_000;

@Injectable()
export class ReplayPendingLifecycleDateFactsService implements ReplayPendingLifecycleDateFactsPort {
  constructor(
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly repository: LifecycleDateFactRepository,
    @Inject(APPLY_LIFECYCLE_EVENT_ONCE)
    private readonly applyLifecycleEvent: ApplyLifecycleEventOncePort,
  ) {}

  async execute(
    input: ReplayPendingLifecycleDateFactsInput,
  ): Promise<ReplayPendingLifecycleDateFactsResult> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new HttpException(
        "VALIDATION_RANGE: limit 必须在 1..100",
        HttpStatus.BAD_REQUEST,
      );
    }
    const now = new Date();
    const owner = randomUUID();
    const facts = await this.repository.claimPendingApplications({
      tenantId: input.tenantId,
      containerId: input.containerId,
      owner,
      now,
      leaseUntil: new Date(now.getTime() + LEASE_MILLISECONDS),
      limit,
    });
    const result: ReplayPendingLifecycleDateFactsResult = {
      claimed: facts.length,
      applied: 0,
      pending: 0,
      rejected: 0,
    };

    for (const fact of facts) {
      try {
        const applied = await this.applyLifecycleEvent.execute({
          containerId: fact.containerId,
          tenantId: fact.tenantId,
          eventCode: fact.eventCode,
          occurredAt: fact.occurredAt,
          idempotencyKey: `date-fact:${fact.id}`,
          evidenceRefs: fact.evidenceRefs,
          domainFactId: fact.id,
          traceId: fact.traceId,
        });
        if ((applied.pendingNodes?.length ?? 0) > 0) {
          const pendingNode = applied.pendingNodes[0];
          await this.repository.finishClaimedApplication({
            factId: fact.id,
            owner,
            state: "pending_application",
            reasonCode:
              (pendingNode && applied.pendingReasonCodes[pendingNode]) ??
              "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
            canonicalEventId: null,
          });
          result.pending += 1;
          continue;
        }
        await this.repository.finishClaimedApplication({
          factId: fact.id,
          owner,
          state: "applied",
          reasonCode: null,
          canonicalEventId: applied.canonicalEventId,
        });
        result.applied += 1;
      } catch (error) {
        const decision = classifyLifecycleApplicationFailure(error);
        await this.repository.finishClaimedApplication({
          factId: fact.id,
          owner,
          state: decision.state,
          reasonCode: decision.reasonCode,
          canonicalEventId: null,
        });
        result[decision.state === "rejected" ? "rejected" : "pending"] += 1;
      }
    }
    return result;
  }
}
