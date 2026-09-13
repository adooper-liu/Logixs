import { Injectable } from "@nestjs/common";
import { ApplyLifecycleEventService } from "../application/apply-lifecycle-event.service";
import type { InboxConsumptionPort } from "../application/process-inbox-batch.service";
import {
  classifyHttpConsumeError,
  InboxConsumptionError,
} from "../domain/inbox-failure";
import { parseInboxApplyPayload } from "../domain/inbox-apply-payload";
import type { ClaimedInbox } from "../domain/inbox-processing";

@Injectable()
export class LifecycleInboxConsumption implements InboxConsumptionPort {
  constructor(
    private readonly applyLifecycleEvent: ApplyLifecycleEventService,
  ) {}

  async consume(message: ClaimedInbox): Promise<void> {
    let payload;
    try {
      payload = parseInboxApplyPayload(message.payloadJson);
    } catch (error) {
      throw new InboxConsumptionError(
        "schema_invalid",
        error instanceof Error ? error.message : "schema_invalid",
      );
    }

    try {
      await this.applyLifecycleEvent.execute({
        containerId: payload.containerId,
        tenantId: message.tenantId,
        eventCode: payload.eventCode,
        occurredAt: payload.occurredAt,
        idempotencyKey: payload.idempotencyKey,
        evidenceRefs: payload.evidenceRefs,
        traceId: message.traceId,
        completeInbox: {
          id: message.id,
          owner: message.lease.owner,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      throw classifyHttpConsumeError(error);
    }
  }
}
