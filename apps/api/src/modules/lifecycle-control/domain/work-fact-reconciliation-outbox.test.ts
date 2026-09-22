import { describe, expect, it } from "vitest";
import {
  buildWorkFactReconciliationOutboxPending,
  canonicalizeWorkFactReconciliationPayload,
  WORK_FACT_RECONCILIATION_EVENT_TYPE,
} from "./work-fact-reconciliation-outbox";

const BASE = {
  nodeEventApplicationId: "application-1",
  tenantId: "tenant-1",
  containerId: "container-1",
  flowInstanceId: "flow-1",
  nodeInstanceId: "node-1",
  canonicalEventId: "event-1",
  occurredAt: new Date("2026-09-21T08:00:00.000Z"),
  traceId: "trace-1",
};

describe("work fact reconciliation Outbox", () => {
  it("builds a deterministic reference, hash and idempotency key", () => {
    const first = buildWorkFactReconciliationOutboxPending(BASE);
    const second = buildWorkFactReconciliationOutboxPending(BASE);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      eventType: WORK_FACT_RECONCILIATION_EVENT_TYPE,
      aggregateType: "node_event_application",
      aggregateId: "application-1",
      payloadRef: "node-event-application/application-1",
      causationId: "event-1",
      idempotencyKey: "reconcile-applied-lifecycle-fact/event-1/node-1",
      state: "pending",
      attemptCount: 0,
    });
    expect(first.id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    expect(first.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses one independent message identity for each target node", () => {
    const other = buildWorkFactReconciliationOutboxPending({
      ...BASE,
      nodeEventApplicationId: "application-2",
      nodeInstanceId: "node-2",
    });
    const first = buildWorkFactReconciliationOutboxPending(BASE);

    expect(other.id).not.toBe(first.id);
    expect(other.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(other.payloadHash).not.toBe(first.payloadHash);
  });

  it("canonical payload matches the historical PostgreSQL jsonb field order", () => {
    expect(canonicalizeWorkFactReconciliationPayload(BASE)).toBe(
      '{"tenantId": "tenant-1", "containerId": "container-1", "flowInstanceId": "flow-1", "nodeInstanceId": "node-1", "canonicalEventId": "event-1", "nodeEventApplicationId": "application-1"}',
    );
  });
});
