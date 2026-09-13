import { describe, expect, it } from "vitest";
import { FIRST_SLICE_CLIENT_ACTION } from "./client-operation";
import {
  FIRST_SLICE_COMPENSATION_ACTION,
  applyCompensationResolve,
  assertCompensationCommand,
  buildPendingCompensation,
  compensationActionFor,
  decideRequestCompensation,
  decideResolveCompensation,
  hashCompensationRequest,
  parseCompensationResolveState,
} from "./compensation";

describe("compensationActionFor", () => {
  it("lifecycle.apply_event 有补偿动作", () => {
    expect(compensationActionFor(FIRST_SLICE_CLIENT_ACTION)).toBe(
      FIRST_SLICE_COMPENSATION_ACTION,
    );
  });

  it("工单完成没有补偿语义", () => {
    expect(
      compensationActionFor("work_execution.complete_work_order"),
    ).toBeNull();
  });
});

describe("decideRequestCompensation", () => {
  it("跨租户拒绝", () => {
    expect(
      decideRequestCompensation({
        tenantId: "t1",
        commandTenantId: "other",
        commitState: "committed",
        actionCode: FIRST_SLICE_CLIENT_ACTION,
      }),
    ).toMatchObject({ kind: "reject", code: "AUTHORIZATION_SCOPE_DENIED" });
  });

  it("未落账拒绝", () => {
    expect(
      decideRequestCompensation({
        tenantId: "t1",
        commandTenantId: "t1",
        commitState: "pending",
        actionCode: FIRST_SLICE_CLIENT_ACTION,
      }),
    ).toMatchObject({ kind: "reject", code: "BUSINESS_STATE_VIOLATION" });
  });

  it("无补偿语义拒绝", () => {
    expect(
      decideRequestCompensation({
        tenantId: "t1",
        commandTenantId: "t1",
        commitState: "committed",
        actionCode: "work_execution.complete_work_order",
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "动作未提供补偿语义",
    });
  });

  it("已落账且目录允许可通过", () => {
    expect(
      decideRequestCompensation({
        tenantId: "t1",
        commandTenantId: "t1",
        commitState: "committed",
        actionCode: FIRST_SLICE_CLIENT_ACTION,
      }),
    ).toEqual({ kind: "ok", actionCode: FIRST_SLICE_COMPENSATION_ACTION });
  });
});

describe("buildPendingCompensation", () => {
  it("新记录为 pending，不复用原 id", () => {
    const now = new Date("2026-09-13T03:00:00.000Z");
    const record = buildPendingCompensation({
      id: "cmp-1",
      tenantId: "t1",
      originalClientOperationId: "op-1",
      compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
      reasonCode: "manual_compensate",
      requestedBy: "actor-1",
      idempotencyKey: "cmp-key-1",
      requestHash: hashCompensationRequest({
        reasonCode: "manual_compensate",
        compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
      }),
      traceId: "trace-1",
      now,
    });
    expect(record.state).toBe("pending");
    expect(record.id).not.toBe("op-1");
    expect(record.originalClientOperationId).toBe("op-1");
    expect(record.resultRefs).toEqual([]);
  });

  it("复用原 clientOperationId 拒绝", () => {
    expect(() =>
      buildPendingCompensation({
        id: "op-1",
        tenantId: "t1",
        originalClientOperationId: "op-1",
        compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
        reasonCode: "manual_compensate",
        requestedBy: "actor-1",
        idempotencyKey: "cmp-key-1",
        requestHash: "a".repeat(64),
        traceId: "trace-1",
        now: new Date(),
      }),
    ).toThrow("VALIDATION_FORMAT");
  });

  it("空 reasonCode 拒绝", () => {
    expect(() =>
      assertCompensationCommand({
        reasonCode: "  ",
        idempotencyKey: "k1",
        requestedBy: "op",
      }),
    ).toThrow("VALIDATION_FORMAT");
  });
});

describe("decideResolveCompensation", () => {
  const BASE = {
    tenantId: "t1",
    commandTenantId: "t1",
    originalClientOperationId: "op-1",
    pathOperationId: "op-1",
  };

  it("pending 可到 compensated", () => {
    expect(
      decideResolveCompensation({
        ...BASE,
        current: "pending",
        next: "compensated",
      }),
    ).toEqual({ kind: "ok" });
  });

  it("同态重放", () => {
    expect(
      decideResolveCompensation({
        ...BASE,
        current: "compensated",
        next: "compensated",
      }),
    ).toEqual({ kind: "replay" });
  });

  it("compensated 后再改拒绝", () => {
    expect(
      decideResolveCompensation({
        ...BASE,
        current: "compensated",
        next: "failed",
      }),
    ).toMatchObject({ kind: "reject", code: "BUSINESS_STATE_VIOLATION" });
  });

  it("failed 可进人工复核", () => {
    expect(
      decideResolveCompensation({
        ...BASE,
        current: "failed",
        next: "manual_review",
      }),
    ).toEqual({ kind: "ok" });
  });

  it("路径操作 id 不匹配拒绝", () => {
    expect(
      decideResolveCompensation({
        ...BASE,
        pathOperationId: "op-other",
        current: "pending",
        next: "compensated",
      }),
    ).toMatchObject({ kind: "reject", code: "RESOURCE_NOT_FOUND" });
  });

  it("未知目标状态拒绝", () => {
    expect(() => parseCompensationResolveState("not_required")).toThrow(
      "VALIDATION_FORMAT",
    );
  });

  it("推进后原 id 与请求原因不变", () => {
    const now = new Date("2026-09-13T04:00:00.000Z");
    const pending = buildPendingCompensation({
      id: "cmp-1",
      tenantId: "t1",
      originalClientOperationId: "op-1",
      compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
      reasonCode: "manual_compensate",
      requestedBy: "actor-1",
      idempotencyKey: "cmp-key-1",
      requestHash: "a".repeat(64),
      traceId: "trace-1",
      now: new Date("2026-09-13T03:00:00.000Z"),
    });
    const resolved = applyCompensationResolve({
      record: pending,
      next: "compensated",
      resultRefs: [{ entityType: "note", entityId: "n1" }],
      now,
    });
    expect(resolved.state).toBe("compensated");
    expect(resolved.id).toBe("cmp-1");
    expect(resolved.originalClientOperationId).toBe("op-1");
    expect(resolved.reasonCode).toBe("manual_compensate");
    expect(resolved.resultRefs).toEqual([
      { entityType: "note", entityId: "n1" },
    ]);
  });
});
