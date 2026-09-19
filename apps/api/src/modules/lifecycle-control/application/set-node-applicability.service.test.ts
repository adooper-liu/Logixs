import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { SetNodeApplicabilityService } from "./set-node-applicability.service";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";

const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");

const ACTOR = "11111111-1111-4111-8111-111111111111";
const EVIDENCE = "22222222-2222-4222-8222-222222222222";

function validInput() {
  return {
    containerId: "c1",
    tenantId: "t1",
    nodeCode: "transshipment",
    applicability: "optional_not_applicable" as const,
    evidenceRefs: [EVIDENCE],
    reasonCode: "direct_service",
    actorId: ACTOR,
    expectedVersion: 0,
    idempotencyKey: "na-1",
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
  assertEvidenceRefs: { execute: ReturnType<typeof vi.fn> } = {
    execute: vi.fn().mockResolvedValue(undefined),
  },
  replayPending: { execute: ReturnType<typeof vi.fn> } = {
    execute: vi.fn().mockResolvedValue(undefined),
  },
) {
  const module = await Test.createTestingModule({
    providers: [
      SetNodeApplicabilityService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
      {
        provide: ReplayPendingLifecycleDateFactsService,
        useValue: replayPending,
      },
    ],
  }).compile();
  return module.get(SetNodeApplicabilityService);
}

describe("SetNodeApplicabilityService", () => {
  it("required 节点拒绝", async () => {
    const service = await buildService({
      findApplicabilityDecision: vi.fn(),
      findContainerBase: vi.fn().mockResolvedValue({
        tenantId: "t1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "shipped",
      }),
      findFlowByContainer: vi.fn().mockResolvedValue({
        flow: { id: "f1", containerId: "c1", state: "active", version: 0 },
        nodes: [],
      }),
      applyNodeApplicability: vi.fn(),
    });

    await expect(
      service.execute({ ...validInput(), nodeCode: "ocean_transit" }),
    ).rejects.toThrow("BUSINESS_STATE_VIOLATION");
  });

  it("跨租户拒绝", async () => {
    const applyNodeApplicability = vi.fn();
    const service = await buildService({
      findApplicabilityDecision: vi.fn(),
      findContainerBase: vi.fn().mockResolvedValue({
        tenantId: "t1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "shipped",
      }),
      findFlowByContainer: vi.fn(),
      applyNodeApplicability,
    });

    await expect(
      service.execute({ ...validInput(), tenantId: "other" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    expect(applyNodeApplicability).not.toHaveBeenCalled();
  });

  it("缺 actorId 拒绝", async () => {
    const service = await buildService({
      findApplicabilityDecision: vi.fn(),
      findFlowByContainer: vi.fn(),
    });

    await expect(
      service.execute({ ...validInput(), actorId: "" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
  });

  it("缺证据拒绝", async () => {
    const service = await buildService({
      findApplicabilityDecision: vi.fn(),
      findFlowByContainer: vi.fn(),
    });

    await expect(
      service.execute({ ...validInput(), evidenceRefs: [] }),
    ).rejects.toThrow("VALIDATION_FORMAT");
  });

  it("expectedVersion 冲突拒绝", async () => {
    const service = await buildService({
      findApplicabilityDecision: vi.fn().mockResolvedValue(null),
      findContainerBase: vi.fn().mockResolvedValue({
        tenantId: "t1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "shipped",
      }),
      findFlowByContainer: vi.fn().mockResolvedValue({
        flow: { id: "f1", containerId: "c1", state: "active", version: 2 },
        nodes: [],
      }),
      applyNodeApplicability: vi.fn(),
    });

    await expect(service.execute(validInput())).rejects.toThrow(
      "CONCURRENCY_CONFLICT",
    );
  });

  it("首次写入成功", async () => {
    const applyNodeApplicability = vi.fn().mockResolvedValue({ version: 1 });
    const replayPending = { execute: vi.fn().mockResolvedValue(undefined) };
    const service = await buildService(
      {
        findApplicabilityDecision: vi.fn().mockResolvedValue(null),
        findContainerBase: vi.fn().mockResolvedValue({
          tenantId: "t1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "shipped",
        }),
        findFlowByContainer: vi.fn().mockResolvedValue({
          flow: { id: "f1", containerId: "c1", state: "active", version: 0 },
          nodes: [],
        }),
        applyNodeApplicability,
      },
      undefined,
      replayPending,
    );

    const result = await service.execute(validInput());

    expect(result).toMatchObject({
      flowInstanceId: "f1",
      nodeCode: "transshipment",
      applicability: "optional_not_applicable",
      applied: true,
      version: 1,
    });
    expect(applyNodeApplicability).toHaveBeenCalled();
    expect(replayPending.execute).toHaveBeenCalledWith({
      tenantId: "t1",
      containerId: "c1",
    });
  });

  it("不合格证据拒绝写入", async () => {
    const applyNodeApplicability = vi.fn();
    const assertEvidenceRefs = {
      execute: vi.fn().mockRejectedValue(new Error("EVIDENCE_REQUIRED")),
    };
    const service = await buildService(
      {
        findApplicabilityDecision: vi.fn().mockResolvedValue(null),
        findContainerBase: vi.fn().mockResolvedValue({
          tenantId: "t1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "shipped",
        }),
        findFlowByContainer: vi.fn().mockResolvedValue({
          flow: { id: "f1", containerId: "c1", state: "active", version: 0 },
          nodes: [],
        }),
        applyNodeApplicability,
      },
      assertEvidenceRefs,
    );

    await expect(service.execute(validInput())).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
    expect(applyNodeApplicability).not.toHaveBeenCalled();
  });

  it("同幂等键重放不重复写", async () => {
    const applyNodeApplicability = vi.fn();
    const service = await buildService({
      findApplicabilityDecision: vi.fn().mockResolvedValue({
        flowInstanceId: "f1",
        nodeCode: "transshipment",
        applicability: "optional_not_applicable",
        version: 1,
      }),
      findContainerBase: vi.fn().mockResolvedValue({
        tenantId: "t1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "shipped",
      }),
      findFlowByContainer: vi.fn(),
      applyNodeApplicability,
    });

    const result = await service.execute(validInput());

    expect(result.applied).toBe(false);
    expect(applyNodeApplicability).not.toHaveBeenCalled();
  });
});
