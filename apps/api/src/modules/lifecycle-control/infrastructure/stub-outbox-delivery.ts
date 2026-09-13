import { Injectable } from "@nestjs/common";
import type { ClaimedOutbox } from "../domain/outbox-publish";

@Injectable()
export class StubOutboxDelivery {
  async deliver(
    message: Pick<ClaimedOutbox, "eventId">,
  ): Promise<{ brokerReference: string }> {
    return { brokerReference: `stub:${message.eventId}` };
  }
}
