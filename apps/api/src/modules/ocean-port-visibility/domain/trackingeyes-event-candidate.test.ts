import { describe, expect, it } from "vitest";
import { normalizeTrackingEyesContainerStatus } from "./trackingeyes-event-candidate";

const BASE_INPUT = {
  providerEventId: "8790030123456789",
  localKey: "container-42",
  containerNumber: "TEST0000001",
  rawCode: "DLPT",
  eventTime: "2026-09-18T10:30:00+08:00",
  isEstimate: false,
  sourceCode: "1",
  dataState: "add" as const,
};

describe("normalizeTrackingEyesContainerStatus", () => {
  it("把已登记实际事件转换为不可自动过站的规范候选", () => {
    const result = normalizeTrackingEyesContainerStatus(BASE_INPUT);

    expect(result.kind).toBe("candidate");
    if (result.kind !== "candidate") return;
    expect(result.candidate).toMatchObject({
      eventCode: "departed",
      timeKind: "actual",
      sourceSignal: "carrier",
      idempotencyKey: "trackingeyes:event:8790030123456789",
      mappingVerification: "pending_provider_validation",
      lifecycleApplication: "review_required",
      reviewReasons: [
        "mapping_pending_provider_validation",
        "source_authority_policy_required",
      ],
    });
    expect(result.candidate.occurredAt.toISOString()).toBe(
      "2026-09-18T02:30:00.000Z",
    );
  });

  it("预计且由供应商计算的事件保留两类限制", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      rawCode: "BDAR",
      isEstimate: true,
      sourceCode: "4",
    });

    expect(result.kind).toBe("candidate");
    if (result.kind !== "candidate") return;
    expect(result.candidate).toMatchObject({
      eventCode: "arrived",
      timeKind: "estimated",
      sourceSignal: "provider_computed",
      lifecycleApplication: "review_required",
    });
    expect(result.candidate.reviewReasons).toEqual(
      expect.arrayContaining(["estimated_event", "provider_computed"]),
    );
  });

  it("未知事件码进入明确的映射复核结果", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      rawCode: "NEW1",
    });

    expect(result).toMatchObject({
      kind: "review_required",
      reasonCode: "EXTERNAL_CODE_UNMAPPED",
      rawCode: "NEW1",
      idempotencyKey: "trackingeyes:event:8790030123456789",
    });
  });

  it("未知来源保留原码并要求复核", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      sourceCode: "9",
    });

    expect(result.kind).toBe("candidate");
    if (result.kind !== "candidate") return;
    expect(result.candidate.sourceCodeRaw).toBe("9");
    expect(result.candidate.sourceSignal).toBe("unknown");
    expect(result.candidate.reviewReasons).toContain("unknown_source_code");
  });

  it("没有时区的时间不假定 UTC", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      eventTime: "2026-09-18 10:30:00",
    });

    expect(result).toMatchObject({
      kind: "review_required",
      reasonCode: "EXTERNAL_EVENT_TIME_ZONE_REQUIRED",
      eventTimeRaw: "2026-09-18 10:30:00",
      idempotencyKey: "trackingeyes:event:8790030123456789",
    });
  });

  it("删除动态只形成更正或撤回待复核意图", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      dataState: "delete",
    });

    expect(result).toMatchObject({
      kind: "review_required",
      reasonCode: "EXTERNAL_EVENT_RELATION_REVIEW_REQUIRED",
      relationIntent: "revoke_or_correct",
      providerEventId: "8790030123456789",
      idempotencyKey: "trackingeyes:event:8790030123456789",
    });
  });

  it("无时区待复核事件使用原始时间组成稳定幂等键", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      providerEventId: undefined,
      eventTime: "2026-09-18 10:30:00",
    });

    expect(result).toMatchObject({
      kind: "review_required",
      reasonCode: "EXTERNAL_EVENT_TIME_ZONE_REQUIRED",
      idempotencyKey:
        "trackingeyes:local:container-42:DLPT:2026-09-18 10:30:00",
    });
  });

  it("无供应商事件 ID 时使用 localKey 组合幂等键", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      providerEventId: undefined,
    });

    expect(result.kind).toBe("candidate");
    if (result.kind !== "candidate") return;
    expect(result.candidate.idempotencyKey).toBe(
      "trackingeyes:local:container-42:DLPT:2026-09-18T02:30:00.000Z",
    );
  });

  it("组合键缺失时可降级为规范化载荷哈希", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      providerEventId: undefined,
      localKey: undefined,
      payloadHash: "A".repeat(64),
    });

    expect(result.kind).toBe("candidate");
    if (result.kind !== "candidate") return;
    expect(result.candidate.idempotencyKey).toBe(
      `trackingeyes:payload:${"a".repeat(64)}`,
    );
  });

  it("没有任何稳定幂等材料时明确拒绝", () => {
    const result = normalizeTrackingEyesContainerStatus({
      ...BASE_INPUT,
      providerEventId: undefined,
      localKey: undefined,
      payloadHash: "not-a-sha256",
    });

    expect(result).toMatchObject({
      kind: "rejected",
      reasonCode: "IDEMPOTENCY_KEY_REQUIRED",
    });
  });
});
