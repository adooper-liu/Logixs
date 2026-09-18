import { describe, expect, it } from "vitest";
import type {
  ProviderEventIngestionRecord,
  ProviderEventIngestionRepository,
} from "../domain/provider-event-ingestion.repository";
import {
  IngestTrackingEyesEventService,
  TRACKINGEYES_CONTAINER_STATUS_CONSUMER,
} from "./ingest-trackingeyes-event.service";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
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

function buildService() {
  const repository = new MemoryProviderEventIngestionRepository();
  return {
    repository,
    service: new IngestTrackingEyesEventService(repository),
  };
}

describe("IngestTrackingEyesEventService", () => {
  it("原始载荷与候选裁决落库，但不应用生命周期", async () => {
    const { service, repository } = buildService();

    const result = await service.execute(BASE_INPUT);

    expect(result).toMatchObject({
      receptionState: "processed",
      applied: true,
      normalizationKind: "candidate",
      canonicalEventCode: "departed",
      authorityDecision: "review_required",
      confidenceState: "unknown",
      lifecycleApplication: "not_applied",
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
        "business_object_resolution_required",
      ]),
      lifecycleApplication: "not_applied",
    });
    expect(stored?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
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
    const { service } = buildService();

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
  });

  it("同一 Inbox messageId 同载荷幂等返回原结果", async () => {
    const { service, repository } = buildService();
    const first = await service.execute(BASE_INPUT);

    const duplicate = await service.execute(BASE_INPUT);

    expect(duplicate).toMatchObject({
      ingestionId: first.ingestionId,
      inboxRecordId: first.inboxRecordId,
      receptionState: "duplicate",
      applied: false,
    });
    expect(repository.records).toHaveLength(1);
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
