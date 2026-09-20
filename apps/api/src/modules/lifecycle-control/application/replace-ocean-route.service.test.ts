import { ForbiddenException, HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { ASSERT_CONTAINER_TENANT } from "../../shipment-registry";
import { OCEAN_ROUTE_REPOSITORY } from "../domain/ocean-route.repository";
import type { ReplaceOceanRoutePersistenceInput } from "../domain/ocean-route.repository";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";
import { ReplaceOceanRouteService } from "./replace-ocean-route.service";

const command = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  containerId: "22222222-2222-4222-8222-222222222222",
  segments: [
    {
      transportMode: "vessel" as const,
      originUnlocode: "CNNGB",
      originTimezone: "Asia/Shanghai",
      destinationLocationType: "port" as const,
      destinationUnlocode: "USLAX",
      destinationTimezone: "America/Los_Angeles",
    },
  ],
  ingestionChannel: "api" as const,
  sourceSystem: "carrier.route-api",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  expectedVersion: 0,
  idempotencyKey: "route:booking-1:v1",
  traceId: "trace-1",
};

async function buildService(duplicate = false) {
  const repository = {
    replace: vi
      .fn()
      .mockImplementation(async (input: ReplaceOceanRoutePersistenceInput) => ({
        duplicate,
        record: {
          routePlanId: input.routePlanId,
          version: 1,
          segments: input.segments.map((segment, index) => ({
            segmentId: input.segmentIds[index],
            sequence: index + 1,
            isFinal: index === input.segments.length - 1,
            ...segment,
          })),
        },
      })),
  };
  const replayPending = {
    execute: vi.fn().mockResolvedValue({
      claimed: 1,
      applied: 1,
      pending: 0,
      rejected: 0,
    }),
  };
  const assertContainer = { execute: vi.fn() };
  const assertEvidence = { execute: vi.fn() };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceOceanRouteService,
      { provide: OCEAN_ROUTE_REPOSITORY, useValue: repository },
      { provide: ASSERT_CONTAINER_TENANT, useValue: assertContainer },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidence },
      {
        provide: ReplayPendingLifecycleDateFactsService,
        useValue: replayPending,
      },
    ],
  }).compile();
  return {
    service: module.get(ReplaceOceanRouteService),
    repository,
    replayPending,
    assertContainer,
    assertEvidence,
  };
}

describe("ReplaceOceanRouteService", () => {
  it("保存新路线后自动重放本柜待应用日期事实", async () => {
    const context = await buildService();
    const result = await context.service.execute(command);

    expect(context.assertContainer.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerId,
    });
    expect(context.assertEvidence.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      subjectType: "container",
      subjectId: command.containerId,
      evidenceIds: command.evidenceRefs,
    });
    expect(context.repository.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 0,
        payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        routePlanId: expect.any(String),
        segmentIds: [expect.any(String)],
      }),
    );
    expect(context.replayPending.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerId,
    });
    expect(result).toMatchObject({
      recordState: "recorded",
      version: 1,
      replay: { applied: 1 },
    });
  });

  it("幂等重复仍重放未完成事实并返回 duplicate", async () => {
    const context = await buildService(true);
    const result = await context.service.execute(command);
    expect(result.recordState).toBe("duplicate");
    expect(context.replayPending.execute).toHaveBeenCalledTimes(1);
  });

  it("人工写入必须由 lifecycle.operate 操作者发起", async () => {
    const context = await buildService();
    await expect(
      context.service.execute({
        ...command,
        ingestionChannel: "manual_ui",
        actorId: "44444444-4444-4444-8444-444444444444",
        reasonCode: "route_correction",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(context.repository.replace).not.toHaveBeenCalled();
  });

  it("版本冲突使用稳定 409 错误码", async () => {
    const context = await buildService();
    context.repository.replace.mockRejectedValueOnce(
      new Error("LIFECYCLE_VERSION_CONFLICT"),
    );
    const failure = await context.service
      .execute(command)
      .catch((error) => error);
    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(409);
    expect((failure as Error).message).toBe("LIFECYCLE_VERSION_CONFLICT");
  });
});
