import { describe, expect, it } from "vitest";
import {
  buildInboxReceived,
  decideInboxIdempotency,
  parseInboxConsumerName,
} from "./inbox-message";

const NOW = new Date("2026-09-13T00:00:00.000Z");
const HASH = "a".repeat(64);
const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";

describe("parseInboxConsumerName", () => {
  it("只接受本刀消费者", () => {
    expect(parseInboxConsumerName(" lifecycle-control-inbox ")).toBe(
      "lifecycle-control-inbox",
    );
    expect(() => parseInboxConsumerName("other-consumer")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});

describe("buildInboxReceived / decideInboxIdempotency", () => {
  it("构造 received，同哈希复用，异哈希冲突", () => {
    const record = buildInboxReceived({
      id: "22222222-2222-4222-8222-222222222222",
      tenantId: " t1 ",
      consumerName: "lifecycle-control-inbox",
      messageId: MESSAGE_ID,
      payloadHash: HASH,
      payloadJson: { containerId: "c1" },
      traceId: "trace-1",
      receivedAt: NOW,
    });
    expect(record.state).toBe("received");
    expect(record.tenantId).toBe("t1");
    expect(decideInboxIdempotency(HASH, HASH)).toBe("reuse");
    expect(decideInboxIdempotency(HASH, "b".repeat(64))).toBe("conflict");
    expect(() =>
      buildInboxReceived({
        ...record,
        messageId: "not-uuid",
      }),
    ).toThrow("VALIDATION_FORMAT");
  });
});
