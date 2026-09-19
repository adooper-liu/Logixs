import { describe, expect, it, vi } from "vitest";
import type {
  ProviderEventIngestionRecord,
  ProviderEventIngestionRepository,
} from "../domain/provider-event-ingestion.repository";
import {
  IngestTrackingEyesEventService,
  TRACKINGEYES_CONTAINER_STATUS_CONSUMER,
} from "./ingest-trackingeyes-event.service";
import type { ResolveContainerByNumberPort } from "../../shipment-registry";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID = "22222222-2222-4222-8222-222222222222";
const FACT_ID = "33333333-3333-4333-8333-333333333333";
const BASE_INPUT = {
  tenantId: "tenant-1",
  serviceId: "service:trackingeyes-adapter",
  messageId: MESSAGE_ID,
  traceId: "trace-1",
  payload: {
    providerEventId: "8790030123456789",
    localKey: "container-42",
    containerNumber: "TEST0000001",
    rawCode: "DLPT",
    eventTime: "2026-09-18T10:30:00+08:00",
    isEstimate: false,
    sourceCode: "1",
    dataState: "add" as const,
  },
};

class MemoryProviderEventIngestionRepository implements ProviderEventIngestionRepository {
  readonly records = new Map<string, ProviderEventIngestionRecord>();

  findByInboxMessage(input: {
    consumerName: string;
    messageId: string;
  }): Promise<ProviderEventIngestionRecord | null> {
    return Promise.resolve(
      this.records.get(`${input.consumerName}:${input.messageId}`) ?? null,
    );
  }

  insertProcessed(record: ProviderEventIngestionRecord): Promise<void> {
    this.records.set(`${record.consumerName}:${record.messageId}`, record);
    return Promise.resolve();
  }
}

function buildService(
  resolution: Awaited<ReturnType<ResolveContainerByNumberPort["execute"]>> = {
    state: "resolved",
    containerId: "container-42",
  },
) {
  const repository = new MemoryProviderEventIngestionRepository();
  const resolveContainer: ResolveContainerByNumberPort = {
    execute: vi.fn().mockResolvedValue(resolution),
  };
  const registerEvidence = {
    execute: vi.fn().mockResolvedValue({ id: EVIDENCE_ID }),
  };
  const recordDateFact = {
    execute: vi.fn().mockResolvedValue({
      factId: FACT_ID,
      recordState: "recorded",
      applicationState: "review_required",
      reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
      canonicalEventId: null,
      projectionVersion: 1,
    }),
  };
  return {
    repository,
    resolveContainer,
    registerEvidence,
    recordDateFact,
    service: new IngestTrackingEyesEventService(
      repository,
      resolveContainer,
      registerEvidence,
      recordDateFact,
    ),
  };
}

describe("IngestTrackingEyesEventService", () => {
  it("原始载荷与候选裁决落库，但不应用生命周期", async () => {
    const { service, repository, registerEvidence, recordDateFact } =
      buildService();

    const result = await service.execute(BASE_INPUT);

    expect(result).toMatchObject({
      receptionState: "processed",
      applied: true,
      normalizationKind: "candidate",
      canonicalEventCode: "departed",
      authorityDecision: "review_required",
      confidenceState: "unknown",
      lifecycleApplication: "not_applied",
      objectResolutionState: "resolved",
      containerRecordId: "container-42",
      evidenceId: EVIDENCE_ID,
      dateFactId: FACT_ID,
      dateFactApplicationState: "review_required",
    });
    const stored = repository.records.get(
      `${TRACKINGEYES_CONTAINER_STATUS_CONSUMER}:${MESSAGE_ID}`,
    );
    expect(stored).toMatchObject({
      tenantId: "tenant-1",
      provider: "trackingeyes",
      providerEventIdRaw: "8790030123456789",
      payloadHashVersion: "trackingeyes-container-status-canonical-v1",
      rawPayload: {
        containerNumber: "TEST0000001",
        rawCode: "DLPT",
      },
      reasonCodes: expect.arrayContaining([
        "mapping_pending_provider_validation",
        "source_authority_policy_required",
      ]),
      objectResolutionState: "resolved",
      containerRecordId: "container-42",
      lifecycleApplication: "not_applied",
    });
    expect(stored?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(registerEvidence.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        idempotencyKey: expect.stringContaining(stored!.id),
        evidenceType: "api_response",
        subjectType: "container",
        subjectId: "container-42",
        originatorSystem: "trackingeyes",
        authoritySystem: "unresolved",
        provider: "trackingeyes",
        interfaceCode: "trackingeyes.container.status",
        sourceEventId: "8790030123456789",
        mappingVersion: "trackingeyes-ocean-reference-2026-09-18",
      }),
    );
    expect(recordDateFact.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        containerId: "container-42",
        nodeCode: "origin_departure",
        eventCode: "departed",
        timeKind: "actual",
        occurredAt: "2026-09-18T02:30:00.000Z",
        rawValue: "2026-09-18T10:30:00+08:00",
        sourceUtcOffset: "+08:00",
        ingestionChannel: "webhook",
        captureSource: "external_evidence",
        sourceSystem: "trackingeyes",
        authoritySystem: "unresolved",
        provider: "trackingeyes",
        verificationState: "pending",
        confidenceState: "unknown",
        evidenceRefs: [EVIDENCE_ID],
      }),
    );
  });

  it("箱号未找到时保留原始事件并进入对象复核", async () => {
    const { service, registerEvidence, recordDateFact } = buildService({
      state: "not_found",
      containerId: null,
    });

    const result = await service.execute(BASE_INPUT);

    expect(result).toMatchObject({
      objectResolutionState: "not_found",
      containerRecordId: null,
      authorityDecision: "review_required",
      lifecycleApplication: "not_applied",
    });
    expect(result.reasonCodes).toContain("business_object_not_found");
    expect(registerEvidence.execute).not.toHaveBeenCalled();
    expect(recordDateFact.execute).not.toHaveBeenCalled();
  });

  it("同租户箱号有多条记录时不猜测货柜", async () => {
    const { service } = buildService({
      state: "ambiguous",
      containerId: null,
    });

    const result = await service.execute(BASE_INPUT);

    expect(result).toMatchObject({
      objectResolutionState: "ambiguous",
      containerRecordId: null,
      authorityDecision: "review_required",
    });
    expect(result.reasonCodes).toContain("business_object_ambiguous");
  });

  it("预计且供应商计算的事件最多形成 provisional", async () => {
    const { service } = buildService();

    const result = await service.execute({
      ...BASE_INPUT,
      payload: {
        ...BASE_INPUT.payload,
        rawCode: "BDAR",
        isEstimate: true,
        sourceCode: "4",
      },
    });

    expect(result).toMatchObject({
      canonicalEventCode: "arrived",
      authorityDecision: "review_required",
      confidenceState: "provisional",
      lifecycleApplication: "not_applied",
    });
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining(["estimated_event", "provider_computed"]),
    );
  });

  it("未知事件码作为待复核接入结果留痕", async () => {
    const { service, registerEvidence, recordDateFact } = buildService();

    const result = await service.execute({
      ...BASE_INPUT,
      payload: { ...BASE_INPUT.payload, rawCode: "NEW1" },
    });

    expect(result).toMatchObject({
      normalizationKind: "review_required",
      canonicalEventCode: null,
      authorityDecision: "review_required",
      confidenceState: "unknown",
      lifecycleApplication: "not_applied",
    });
    expect(result.reasonCodes).toContain("EXTERNAL_CODE_UNMAPPED");
    expect(registerEvidence.execute).not.toHaveBeenCalled();
    expect(recordDateFact.execute).not.toHaveBeenCalled();
  });

  it("无效供应商载荷保存为业务拒绝而不是技术重试", async () => {
    const { service } = buildService();

    const result = await service.execute({
      ...BASE_INPUT,
      payload: { ...BASE_INPUT.payload, containerNumber: "" },
    });

    expect(result).toMatchObject({
      normalizationKind: "rejected",
      authorityDecision: "rejected",
      confidenceState: "unknown",
      lifecycleApplication: "not_applied",
    });
    expect(result.reasonCodes).toEqual(["VALIDATION_FORMAT"]);
    expect(result.objectResolutionState).toBe("not_attempted");
  });

  it("同一 Inbox messageId 同载荷幂等返回原结果", async () => {
    const { service, repository, registerEvidence, recordDateFact } =
      buildService();
    const first = await service.execute(BASE_INPUT);

    const duplicate = await service.execute(BASE_INPUT);

    expect(duplicate).toMatchObject({
      ingestionId: first.ingestionId,
      inboxRecordId: first.inboxRecordId,
      receptionState: "duplicate",
      applied: false,
      evidenceId: EVIDENCE_ID,
      dateFactId: FACT_ID,
    });
    expect(repository.records).toHaveLength(1);
    expect(registerEvidence.execute).toHaveBeenCalledTimes(2);
    expect(recordDateFact.execute).toHaveBeenCalledTimes(2);
  });

  it("原始接入已落库但日期事实失败时，同消息重试从 Evidence 继续", async () => {
    const { service, repository, registerEvidence, recordDateFact } =
      buildService();
    recordDateFact.execute
      .mockRejectedValueOnce(new Error("temporary date fact failure"))
      .mockResolvedValueOnce({
        factId: FACT_ID,
        recordState: "duplicate",
        applicationState: "review_required",
        reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
        canonicalEventId: null,
        projectionVersion: 1,
      });

    await expect(service.execute(BASE_INPUT)).rejects.toThrow(
      "temporary date fact failure",
    );
    expect(repository.records).toHaveLength(1);

    await expect(service.execute(BASE_INPUT)).resolves.toMatchObject({
      receptionState: "duplicate",
      evidenceId: EVIDENCE_ID,
      dateFactId: FACT_ID,
      dateFactApplicationState: "review_required",
    });
    expect(registerEvidence.execute).toHaveBeenCalledTimes(2);
    expect(recordDateFact.execute).toHaveBeenCalledTimes(2);
  });

  it("同一 Inbox messageId 异载荷明确冲突", async () => {
    const { service } = buildService();
    await service.execute(BASE_INPUT);

    const promise = service.execute({
      ...BASE_INPUT,
      payload: { ...BASE_INPUT.payload, voyage: "DIFFERENT" },
    });

    await expect(promise).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("IDEMPOTENCY_CONFLICT"),
    });
  });

  it("同一 Inbox messageId 跨租户碰撞不返回原租户结果", async () => {
    const { service } = buildService();
    await service.execute(BASE_INPUT);

    const promise = service.execute({ ...BASE_INPUT, tenantId: "tenant-2" });

    await expect(promise).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("租户范围冲突"),
    });
  });

  it("messageId 首次与重试均使用去空格后的规范值", async () => {
    const { service, repository } = buildService();
    const spaced = { ...BASE_INPUT, messageId: `  ${MESSAGE_ID}  ` };

    const first = await service.execute(spaced);
    const duplicate = await service.execute(spaced);

    expect(first.messageId).toBe(MESSAGE_ID);
    expect(duplicate.receptionState).toBe("duplicate");
    expect(repository.records).toHaveLength(1);
  });
});
