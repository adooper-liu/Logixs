import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeadLetterQueue from "./DeadLetterQueue.vue";

const listDeadLetters = vi.fn();
const listInboxDeadLetters = vi.fn();
const replayDeadLetter = vi.fn();
const replayInboxDeadLetter = vi.fn();

vi.mock("../api/deadLetters", () => ({
  listDeadLetters: (...args: unknown[]) => listDeadLetters(...args),
  listInboxDeadLetters: (...args: unknown[]) => listInboxDeadLetters(...args),
  replayDeadLetter: (...args: unknown[]) => replayDeadLetter(...args),
  replayInboxDeadLetter: (...args: unknown[]) => replayInboxDeadLetter(...args),
}));

const sampleItem = {
  id: "dl-1",
  eventId: "evt-1",
  eventType: "stuffed",
  aggregateType: "container",
  aggregateId: "c1",
  payloadRef: "canonical-event/evt-1",
  payloadHash: "a".repeat(64),
  attemptCount: 3,
  lastErrorCode: "timeout",
  failureCategory: "transient_technical",
  ownerQueue: "lifecycle-control-outbox",
  deadLetteredAt: "2026-09-13T00:00:00.000Z",
  occurredAt: "2026-09-13T00:00:00.000Z",
  causationId: null,
  traceId: "trace-1",
};

function mountPage() {
  return mount(DeadLetterQueue, {
    global: {
      stubs: {
        PageHeader: {
          props: ["title", "summary"],
          template: "<header><h2>{{ title }}</h2><p>{{ summary }}</p></header>",
        },
      },
    },
  });
}

describe("DeadLetterQueue", () => {
  beforeEach(() => {
    listDeadLetters.mockReset();
    listInboxDeadLetters.mockReset();
    replayDeadLetter.mockReset();
    replayInboxDeadLetter.mockReset();
    vi.stubGlobal("crypto", { randomUUID: () => "replay-key-1" });
  });

  it("列出失败摘要且不渲染载荷哈希", async () => {
    listDeadLetters.mockResolvedValue({
      items: [sampleItem],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 1,
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("看失败");
    expect(wrapper.text()).toContain("stuffed");
    expect(wrapper.text()).toContain("container/c1");
    expect(wrapper.text()).toContain("timeout · transient_technical");
    expect(wrapper.text()).not.toContain("a".repeat(64));
    expect(wrapper.text()).not.toContain("dev-service-key");
  });

  it("空列表给出操作说明", async () => {
    listDeadLetters.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 1,
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("没有需要处理的失败");
  });

  it("确认重放只提交原因、版本和幂等键", async () => {
    listDeadLetters.mockResolvedValue({
      items: [sampleItem],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 1,
    });
    replayDeadLetter.mockResolvedValue({
      deadLetterId: "dl-1",
      replayedOutboxId: "evt-2",
      replayedEventId: "evt-2",
      applied: true,
      corrected: false,
      targetConsumerVersion: "consumer-v1",
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get("button.replay-button").trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(replayDeadLetter).toHaveBeenCalledWith("dl-1", {
      reasonCode: "manual_replay",
      targetConsumerVersion: "consumer-v1",
      idempotencyKey: "replay-key-1",
    });
    expect(wrapper.text()).toContain("已重放为 evt-2");
  });

  it("切换 Inbox 队列后列消费死信并可重放", async () => {
    listDeadLetters.mockResolvedValue({
      items: [sampleItem],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 1,
    });
    listInboxDeadLetters.mockResolvedValue({
      items: [
        {
          ...sampleItem,
          id: "in-1",
          eventId: "msg-1",
          eventType: "lifecycle-control-inbox",
          aggregateType: "inbox",
          aggregateId: "msg-1",
          payloadRef: "inbox/in-1",
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 1,
    });
    replayInboxDeadLetter.mockResolvedValue({
      deadLetterId: "in-1",
      replayedInboxId: "in-2",
      replayedMessageId: "msg-2",
      applied: true,
      targetConsumerVersion: "consumer-v1",
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('button[aria-selected="false"]').trigger("click");
    await flushPromises();
    expect(listInboxDeadLetters).toHaveBeenCalled();
    expect(wrapper.text()).toContain("lifecycle-control-inbox");
    expect(wrapper.text()).toContain("inbox/msg-1");
    expect(wrapper.text()).not.toContain("a".repeat(64));
    await wrapper.get("button.replay-button").trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(replayInboxDeadLetter).toHaveBeenCalledWith("in-1", {
      reasonCode: "manual_replay",
      targetConsumerVersion: "consumer-v1",
      idempotencyKey: "replay-key-1",
    });
    expect(wrapper.text()).toContain("已重放为 msg-2");
  });
});
