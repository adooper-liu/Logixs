import { Injectable } from "@nestjs/common";
import { InitializePostDepartureLifecycleService } from "../application/initialize-post-departure-lifecycle.service";
import { RecordLifecycleDateFactService } from "../application/record-lifecycle-date-fact.service";
import type { InboxConsumptionPort } from "../application/process-inbox-batch.service";
import {
  classifyHttpConsumeError,
  InboxConsumptionError,
} from "../domain/inbox-failure";
import {
  assertInboxPayloadHash,
  parseInboxMessagePayload,
} from "../domain/inbox-apply-payload";
import type { ClaimedInbox } from "../domain/inbox-processing";

@Injectable()
export class LifecycleInboxConsumption implements InboxConsumptionPort {
  constructor(
    private readonly recordLifecycleDateFact: RecordLifecycleDateFactService,
    private readonly initializePostDeparture: InitializePostDepartureLifecycleService,
  ) {}

  async consume(message: ClaimedInbox): Promise<void> {
    let payload;
    try {
      payload = parseInboxMessagePayload(message.payloadJson);
      assertInboxPayloadHash(payload, message.payloadHash);
    } catch (error) {
      throw new InboxConsumptionError(
        "schema_invalid",
        error instanceof Error ? error.message : "schema_invalid",
      );
    }

    try {
      if ("kind" in payload) {
        if (payload.kind === "start_post_departure_lifecycle_v2") {
          await this.initializePostDeparture.execute({
            tenantId: message.tenantId,
            command: payload.command,
            completeInbox: {
              id: message.id,
              owner: message.lease.owner,
              processedAt: new Date(),
            },
          });
          return;
        }
        if (payload.command.tenantId !== message.tenantId) {
          throw new Error("AUTHORIZATION_SCOPE_DENIED: 租户不匹配");
        }
        await this.recordLifecycleDateFact.execute({
          ...payload.command,
          completeInbox: {
            id: message.id,
            owner: message.lease.owner,
            processedAt: new Date(),
          },
        });
        return;
      }
      throw new InboxConsumptionError(
        "business_rejected",
        "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE: 旧事件消息不能直接推进生命周期，请改投日期事实消息",
      );
    } catch (error) {
      throw classifyHttpConsumeError(error);
    }
  }
}
