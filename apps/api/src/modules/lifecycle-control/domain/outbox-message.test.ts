import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_OUTBOX_OWNER,
  buildLifecycleOutboxPending,
  canonicalizeLifecycleOutboxPayload,
  hashOutboxPayload,
} from "./outbox-message";

const BASE = {
  eventId: "11111111-1111-4111-8111-111111111111",
  tenantId: "t1",
  containerId: "c1",
  eventCode: "stuffed" as const,
  domainFactId: "44444444-4444-4444-8444-444444444444",
  nodeCode: "container_stuffing" as const,
  timeKind: "actual" as const,
  authorityPolicyRef: "warehouse-stuffing:1",
  occurredAt: new Date("2026-09-12T10:00:00.000Z"),
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "key-1",
  traceId: "33333333-3333-4333-8333-333333333333",
};

describe("buildLifecycleOutboxPending", () => {
  it("构造 pending 行，id 等于 eventId", () => {
    const row = buildLifecycleOutboxPending(BASE);
    expect(row.id).toBe(BASE.eventId);
    expect(row.eventId).toBe(BASE.eventId);
    expect(row.state).toBe("pending");
    expect(row.attemptCount).toBe(0);
    expect(row.ownerModule).toBe(LIFECYCLE_OUTBOX_OWNER);
    expect(row.payloadRef).toBe(`canonical-event/${BASE.eventId}`);
    expect(row.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.eventType).toBe("stuffed");
    expect(row.aggregateId).toBe("c1");
  });

  it("相同载荷哈希稳定", () => {
    const first = hashOutboxPayload(canonicalizeLifecycleOutboxPayload(BASE));
    const second = hashOutboxPayload(canonicalizeLifecycleOutboxPayload(BASE));
    expect(first).toBe(second);
    expect(buildLifecycleOutboxPending(BASE).payloadHash).toBe(first);
  });

  it("载荷变化则哈希变化", () => {
    const original = buildLifecycleOutboxPending(BASE).payloadHash;
    const changed = buildLifecycleOutboxPending({
      ...BASE,
      evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
    }).payloadHash;
    expect(changed).not.toBe(original);
  });

  it("服务端采用的事实与权威策略属于消息完整性哈希", () => {
    const original = buildLifecycleOutboxPending(BASE).payloadHash;
    expect(
      buildLifecycleOutboxPending({
        ...BASE,
        domainFactId: "55555555-5555-4555-8555-555555555555",
      }).payloadHash,
    ).not.toBe(original);
    expect(
      buildLifecycleOutboxPending({
        ...BASE,
        authorityPolicyRef: "warehouse-stuffing:2",
      }).payloadHash,
    ).not.toBe(original);
  });
});
