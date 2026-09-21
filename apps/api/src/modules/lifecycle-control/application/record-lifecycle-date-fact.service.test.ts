import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import type {
  AppendLifecycleDateFactInput,
  LifecycleDateFactRecord,
} from "../domain/lifecycle-date-fact";
import { LIFECYCLE_DATE_FACT_REPOSITORY } from "../domain/lifecycle-date-fact.repository";
import { APPLY_LIFECYCLE_EVENT_ONCE } from "../apply-lifecycle-event-once.port";
import { EVALUATE_LIFECYCLE_DATE_AUTHORITY } from "../evaluate-lifecycle-date-authority.port";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";
import { RecordLifecycleDateFactService } from "./record-lifecycle-date-fact.service";

const EVIDENCE_ID = "22222222-2222-4222-8222-222222222222";

function baseInput() {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    containerId: "33333333-3333-4333-8333-333333333333",
    nodeCode: "origin_departure" as const,
    eventCode: "departed" as const,
    timeKind: "planned" as const,
    occurredAt: "2026-09-18T08:00:00+08:00",
    rawValue: "2026-09-18 08:00",
    sourceUtcOffset: "+08:00",
    ingestionChannel: "manual_ui" as const,
    captureSource: "manual_backfill" as const,
    sourceSystem: "logix.manual",
    authoritySystem: "carrier-a",
    verificationState: "verified" as const,
    confidenceState: "provisional" as const,
    validity: "effective" as const,
    evidenceRefs: [] as string[],
    actorId: "44444444-4444-4444-8444-444444444444",
    reasonCode: "manual_correction",
    expectedVersion: 0,
    idempotencyKey: "manual:departure:1",
    traceId: "trace-1",
    actorCapabilities: ["lifecycle.operate", "evidence.review"],
  };
}

async function buildService(
  authorityDecision: {
    state: "accepted" | "review_required" | "configuration_error";
    policyRef: string | null;
    reasonCode: string | null;
  } = {
    state: "accepted",
    policyRef: "policy:carrier-departure:v1",
    reasonCode: null,
  },
) {
  let persisted: LifecycleDateFactRecord | null = null;
  const repository = {
    append: vi.fn(async (input: AppendLifecycleDateFactInput) => {
      persisted = {
        ...input,
        isCurrent: true,
        projectionVersion: 1,
        recordedAt: new Date("2026-09-18T00:00:01Z"),
      };
      return { record: persisted, duplicate: false };
    }),
    updateApplication: vi.fn(
      async (input: {
        factId: string;
        state: LifecycleDateFactRecord["applicationState"];
        reasonCode: string | null;
        canonicalEventId: string | null;
      }) => {
        if (!persisted) throw new Error("missing persisted fact");
        persisted = {
          ...persisted,
          applicationState: input.state,
          applicationReasonCode: input.reasonCode,
          canonicalEventId: input.canonicalEventId,
        };
        return persisted;
      },
    ),
    listCurrent: vi.fn(),
  };
  const assertContainerTenant: AssertContainerTenantPort = {
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const assertEvidenceRefs: AssertEvidenceRefsPort = {
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const applyLifecycleEvent = {
    execute: vi.fn().mockResolvedValue({
      applied: true,
      canonicalEventId: "88888888-8888-4888-8888-888888888888",
    }),
  };
  const evaluateAuthority = {
    execute: vi.fn().mockResolvedValue(authorityDecision),
  };
  const replayPending = {
    execute: vi.fn().mockResolvedValue({
      claimed: 0,
      applied: 0,
      pending: 0,
      rejected: 0,
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      RecordLifecycleDateFactService,
      { provide: LIFECYCLE_DATE_FACT_REPOSITORY, useValue: repository },
      { provide: ASSERT_CONTAINER_TENANT, useValue: assertContainerTenant },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
      { provide: APPLY_LIFECYCLE_EVENT_ONCE, useValue: applyLifecycleEvent },
      {
        provide: EVALUATE_LIFECYCLE_DATE_AUTHORITY,
        useValue: evaluateAuthority,
      },
      {
        provide: ReplayPendingLifecycleDateFactsService,
        useValue: replayPending,
      },
    ],
  }).compile();
  return {
    service: module.get(RecordLifecycleDateFactService),
    repository,
    assertEvidenceRefs,
    applyLifecycleEvent,
    evaluateAuthority,
    replayPending,
  };
}

describe("RecordLifecycleDateFactService", () => {
  it("计划日期只更新投影，不申请生命周期事件", async () => {
    const { service, repository, applyLifecycleEvent } = await buildService();

    const result = await service.execute(baseInput());

    expect(result.applicationState).toBe("not_applicable");
    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({ timeKind: "planned" }),
    );
    expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
  });

  it("结构化地点与航段随日期事实一起规范化并持久化", async () => {
    const { service, repository } = await buildService();
    const location = {
      locationType: "port" as const,
      unlocode: "USLAX",
      segmentId: "55555555-5555-4555-8555-555555555555",
      portCallId: " call-1 ",
      timezone: " America/Los_Angeles ",
    };

    await service.execute({ ...baseInput(), location });

    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        location: {
          locationType: "port",
          unlocode: "USLAX",
          segmentId: "55555555-5555-4555-8555-555555555555",
          portCallId: "call-1",
          timezone: "America/Los_Angeles",
        },
      }),
    );
  });

  it.each([
    ["cargo_ready", "cargo_ready", "planned"],
    ["stuffed", "container_stuffing", "estimated"],
    ["container_customs_completed", "customs_clearance", "planned"],
    ["rail_handover", "rail_transfer", "estimated"],
    ["unloaded", "container_unloading", "planned"],
    ["unstuffed", "container_unstuffing", "estimated"],
    ["returned_empty", "empty_return", "estimated"],
  ] as const)(
    "%s 在 %s 的 %s 日期只形成投影，不申请过站",
    async (eventCode, nodeCode, timeKind) => {
      const { service, repository, applyLifecycleEvent } = await buildService();

      const result = await service.execute({
        ...baseInput(),
        eventCode,
        nodeCode,
        timeKind,
        idempotencyKey: `${eventCode}:${timeKind}:1`,
      });

      expect(result.applicationState).toBe("not_applicable");
      expect(repository.append).toHaveBeenCalledWith(
        expect.objectContaining({ eventCode, nodeCode, timeKind }),
      );
      expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
    },
  );

  it("调用方伪造策略引用和 validated=true 也不能绕过运行时裁决", async () => {
    const { service, assertEvidenceRefs, applyLifecycleEvent } =
      await buildService({
        state: "review_required",
        policyRef: null,
        reasonCode: "SOURCE_AUTHORITY_POLICY_NOT_FOUND",
      });

    const result = await service.execute({
      ...baseInput(),
      timeKind: "actual",
      verificationState: "verified",
      confidenceState: "confirmed",
      evidenceRefs: [EVIDENCE_ID],
      authorityPolicyRef: "forged-policy:v999",
      authorityPolicyValidated: true,
    });

    expect(result).toMatchObject({
      applicationState: "review_required",
      reasonCode: "SOURCE_AUTHORITY_POLICY_NOT_FOUND",
    });
    expect(assertEvidenceRefs.execute).not.toHaveBeenCalled();
    expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
  });

  it("已核验且运行时裁决命中唯一策略的实际日期才申请过站", async () => {
    const {
      service,
      repository,
      assertEvidenceRefs,
      applyLifecycleEvent,
      replayPending,
    } = await buildService();

    const result = await service.execute({
      ...baseInput(),
      timeKind: "actual",
      verificationState: "verified",
      confidenceState: "confirmed",
      evidenceRefs: [EVIDENCE_ID],
      authorityPolicyRef: "forged-policy:v999",
      authorityPolicyValidated: false,
    });

    expect(assertEvidenceRefs.execute).toHaveBeenCalledWith({
      tenantId: baseInput().tenantId,
      subjectType: "container",
      subjectId: baseInput().containerId,
      evidenceIds: [EVIDENCE_ID],
    });
    expect(applyLifecycleEvent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: "departed",
        occurredAt: new Date("2026-09-18T00:00:00Z"),
      }),
    );
    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityPolicyRef: "policy:carrier-departure:v1",
      }),
    );
    expect(replayPending.execute).toHaveBeenCalledWith({
      tenantId: baseInput().tenantId,
      containerId: baseInput().containerId,
    });
    expect(result.applicationState).toBe("applied");
    expect(result.canonicalEventId).toBe(
      "88888888-8888-4888-8888-888888888888",
    );
  });

  it("复核岗位可凭 evidence.review 追加已确认事实，无需操作员能力", async () => {
    const { service } = await buildService();

    await expect(
      service.execute({
        ...baseInput(),
        timeKind: "actual",
        verificationState: "verified",
        confidenceState: "confirmed",
        evidenceRefs: [EVIDENCE_ID],
        actorCapabilities: ["evidence.review"],
      }),
    ).resolves.toMatchObject({ applicationState: "applied" });
  });

  it("追踪 ID 不参与幂等载荷哈希", async () => {
    const { service, repository } = await buildService();

    await service.execute(baseInput());
    const firstHash = repository.append.mock.calls[0]?.[0].payloadHash;
    await service.execute({ ...baseInput(), traceId: "trace-retry" });
    const retryHash = repository.append.mock.calls[1]?.[0].payloadHash;

    expect(retryHash).toBe(firstHash);
  });

  it("目标节点暂不可完成时保存状态机返回的真实 pending 原因", async () => {
    const { service, applyLifecycleEvent } = await buildService();
    applyLifecycleEvent.execute.mockResolvedValue({
      applied: false,
      canonicalEventId: "88888888-8888-4888-8888-888888888888",
      pendingNodes: ["origin_departure"],
      pendingReasonCodes: {
        origin_departure: "LIFECYCLE_EVENT_PENDING_NODE_BLOCK",
      },
    });

    const result = await service.execute({
      ...baseInput(),
      timeKind: "actual",
      verificationState: "verified",
      confidenceState: "confirmed",
      evidenceRefs: [EVIDENCE_ID],
    });

    expect(result).toMatchObject({
      applicationState: "pending_application",
      reasonCode: "LIFECYCLE_EVENT_PENDING_NODE_BLOCK",
      canonicalEventId: null,
    });
  });

  it("事件、节点和时间种类组合不在目录中时明确失败", async () => {
    const { service } = await buildService();

    await expect(
      service.execute({ ...baseInput(), eventCode: "loaded" }),
    ).rejects.toThrow("事件与节点不匹配");
    await expect(
      service.execute({
        ...baseInput(),
        eventCode: "empty_picked_up",
        nodeCode: "container_stuffing",
      }),
    ).rejects.toThrow("事件不允许该时间种类");
  });

  it("无时区和人工审计字段不完整时明确失败", async () => {
    const { service } = await buildService();

    await expect(
      service.execute({ ...baseInput(), occurredAt: "2026-09-18T08:00:00" }),
    ).rejects.toThrow("日期必须包含时区");
    await expect(
      service.execute({ ...baseInput(), sourceUtcOffset: "+14:30" }),
    ).rejects.toThrow("日期或来源时区无效");
    await expect(
      service.execute({ ...baseInput(), reasonCode: undefined }),
    ).rejects.toThrow("人工录入缺少操作者、原因或版本");
    await expect(
      service.execute({
        ...baseInput(),
        location: { locationType: "port", timezone: "" },
      }),
    ).rejects.toThrow("location 缺少类型或时区");
  });
});
