import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { EVIDENCE_REPOSITORY } from "../domain/evidence.repository";
import { RegisterEvidenceService } from "./register-evidence.service";

const HASH = "a".repeat(64);
const SUBJECT = "10000000-0000-4000-8000-000000000001";

function validInput() {
  return {
    tenantId: "dev-tenant",
    idempotencyKey: "manual-evidence-1",
    evidenceType: "document",
    subjectType: "container",
    subjectId: SUBJECT,
    authorityLevel: "operational",
    contentRef: "dev://manual/pack-list",
    contentHash: HASH,
    sourceType: "person",
    originatorSystem: "logix-dev",
    authoritySystem: "ops-team",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      RegisterEvidenceService,
      { provide: EVIDENCE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(RegisterEvidenceService);
}

describe("RegisterEvidenceService", () => {
  it("非法 contentHash 拒绝", async () => {
    const create = vi.fn();
    const service = await buildService({ create });
    await expect(
      service.execute({ ...validInput(), contentHash: "not-hash" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(create).not.toHaveBeenCalled();
  });

  it("登记为 pending / unknown / effective", async () => {
    const created = { id: "e1", verificationState: "pending" };
    const findByIdempotencyKey = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue(created);
    const service = await buildService({ findByIdempotencyKey, create });

    await expect(service.execute(validInput())).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "dev-tenant",
        idempotencyKey: "manual-evidence-1",
        subjectType: "container",
        subjectId: SUBJECT,
        source: expect.objectContaining({
          sourceType: "person",
          captureSource: "manual_backfill",
        }),
      }),
    );
  });

  it("外部证据必须保留供应商接口与映射版本", async () => {
    const findByIdempotencyKey = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "e-external" });
    const service = await buildService({ findByIdempotencyKey, create });
    const external = {
      ...validInput(),
      evidenceType: "api_response",
      sourceType: "system",
      originatorSystem: "trackingeyes",
      authoritySystem: "unresolved",
      ingestionChannel: "webhook",
      captureSource: "external_evidence",
    };

    await expect(service.execute(external)).rejects.toThrow(
      "provider/interfaceCode/mappingVersion",
    );
    await service.execute({
      ...external,
      provider: "trackingeyes",
      interfaceCode: "trackingeyes.container.status",
      sourceEventId: "provider-event-1",
      mappingVersion: "trackingeyes-map-v1",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          authoritySystem: "unresolved",
          provider: "trackingeyes",
          interfaceCode: "trackingeyes.container.status",
          sourceEventId: "provider-event-1",
          mappingVersion: "trackingeyes-map-v1",
        }),
      }),
    );
  });

  it("同一幂等键同内容返回原证据", async () => {
    const existing = {
      id: "e1",
      tenantId: "dev-tenant",
      idempotencyKey: "manual-evidence-1",
      evidenceType: "document",
      subjectType: "container",
      subjectId: SUBJECT,
      authorityLevel: "operational",
      contentRef: "dev://manual/pack-list",
      contentHash: HASH,
      source: {
        sourceType: "person",
        originatorSystem: "logix-dev",
        authoritySystem: "ops-team",
        ingestionChannel: "manual_ui",
        captureSource: "manual_backfill",
      },
    };
    const findByIdempotencyKey = vi.fn().mockResolvedValue(existing);
    const create = vi.fn();
    const service = await buildService({ findByIdempotencyKey, create });

    await expect(service.execute(validInput())).resolves.toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it("同一幂等键异内容明确冲突", async () => {
    const findByIdempotencyKey = vi.fn().mockResolvedValue({
      id: "e1",
      ...validInput(),
      contentHash: "b".repeat(64),
      source: {
        sourceType: "person",
        originatorSystem: "logix-dev",
        authoritySystem: "ops-team",
        ingestionChannel: "manual_ui",
        captureSource: "manual_backfill",
      },
    });
    const create = vi.fn();
    const service = await buildService({ findByIdempotencyKey, create });

    await expect(service.execute(validInput())).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("IDEMPOTENCY_CONFLICT"),
    });
    expect(create).not.toHaveBeenCalled();
  });
});
