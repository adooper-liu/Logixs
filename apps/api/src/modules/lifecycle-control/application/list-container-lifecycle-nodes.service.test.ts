import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LIFECYCLE_DATE_FACT_REPOSITORY } from "../domain/lifecycle-date-fact.repository";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ListContainerLifecycleNodesService } from "./list-container-lifecycle-nodes.service";

async function buildService(overrides?: {
  listFlowsWithNodes?: ReturnType<typeof vi.fn>;
  listCurrentForNodeProjection?: ReturnType<typeof vi.fn>;
}) {
  const repository = {
    findFlowByContainer: vi.fn(),
    listCurrentNodes: vi.fn(),
    listFlowsWithNodes:
      overrides?.listFlowsWithNodes ?? vi.fn().mockResolvedValue([]),
    ensureFlow: vi.fn(),
    completeNodes: vi.fn(),
    updateCurrentNode: vi.fn(),
    ensureNode: vi.fn(),
    findContainerBase: vi.fn(),
    findEventByIdempotencyKey: vi.fn(),
    listEvents: vi.fn(),
    saveEvent: vi.fn(),
    findLatestEventTime: vi.fn(),
    findApplicabilityDecision: vi.fn(),
    applyNodeApplicability: vi.fn(),
  };
  const dateFacts = {
    listCurrentForNodeProjection:
      overrides?.listCurrentForNodeProjection ?? vi.fn().mockResolvedValue([]),
  };
  const module = await Test.createTestingModule({
    providers: [
      ListContainerLifecycleNodesService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
      { provide: LIFECYCLE_DATE_FACT_REPOSITORY, useValue: dateFacts },
    ],
  }).compile();
  return {
    service: module.get(ListContainerLifecycleNodesService),
    repository,
    dateFacts,
  };
}

describe("ListContainerLifecycleNodesService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const { service, repository, dateFacts } = await buildService();
    await expect(service.execute({ containerIds: "c1" })).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(repository.listFlowsWithNodes).not.toHaveBeenCalled();
    expect(dateFacts.listCurrentForNodeProjection).not.toHaveBeenCalled();
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });

  it("空 ID → VALIDATION_REQUIRED", async () => {
    const { service, repository, dateFacts } = await buildService();
    await expect(
      service.execute({ tenantId: "t1", containerIds: "" }),
    ).rejects.toThrow("VALIDATION_REQUIRED");
    expect(repository.listFlowsWithNodes).not.toHaveBeenCalled();
    expect(dateFacts.listCurrentForNodeProjection).not.toHaveBeenCalled();
  });

  it("只投影仓库给出的已落库节点，不写库", async () => {
    const { service, repository } = await buildService({
      listFlowsWithNodes: vi.fn().mockResolvedValue([
        {
          flow: {
            id: "f1",
            containerId: "c1",
            state: "active",
            currentNodeCode: "shipment_dispatch",
            version: 1,
          },
          nodes: [
            {
              id: "n-dispatch",
              nodeCode: "shipment_dispatch",
              state: "active",
              completedAt: null,
              applicability: "required",
            },
            {
              id: "n-ready",
              nodeCode: "cargo_ready",
              state: "completed",
              completedAt: new Date("2026-09-01T00:00:00.000Z"),
              applicability: "required",
            },
          ],
        },
      ]),
    });
    const page = await service.execute({
      tenantId: "t1",
      containerIds: "c1,c2",
    });
    expect(page.items).toEqual([
      {
        containerId: "c1",
        flow: {
          id: "f1",
          state: "active",
          currentNodeCode: "shipment_dispatch",
          version: 1,
        },
        nodes: [
          {
            nodeInstanceId: "n-ready",
            nodeCode: "cargo_ready",
            sequence: 1,
            state: "completed",
            applicability: "required",
            completedAt: new Date("2026-09-01T00:00:00.000Z"),
            blockedReasonRefs: [],
            isCurrent: false,
            times: {
              plannedAt: null,
              estimatedAt: null,
              actualAt: null,
            },
          },
          {
            nodeInstanceId: "n-dispatch",
            nodeCode: "shipment_dispatch",
            sequence: 3,
            state: "active",
            applicability: "required",
            completedAt: null,
            blockedReasonRefs: [],
            isCurrent: true,
            times: {
              plannedAt: null,
              estimatedAt: null,
              actualAt: null,
            },
          },
        ],
      },
    ]);
    expect(repository.listFlowsWithNodes).toHaveBeenCalledWith({
      tenantId: "t1",
      containerIds: ["c1", "c2"],
    });
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });

  it("一次读取全部货柜日期事实并按货柜隔离投影", async () => {
    const c1Time = new Date("2026-09-01T01:00:00Z");
    const c2Time = new Date("2026-09-02T01:00:00Z");
    const flows = ["c1", "c2"].map((containerId) => ({
      flow: {
        id: `f-${containerId}`,
        containerId,
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 0,
      },
      nodes: [
        {
          id: `n-${containerId}`,
          nodeCode: "cargo_ready",
          state: "active",
          completedAt: null,
          applicability: "required",
        },
      ],
    }));
    const dateFact = (containerId: string, occurredAt: Date) => ({
      containerId,
      nodeCode: "cargo_ready",
      eventCode: "cargo_ready",
      timeKind: "planned",
      occurredAt,
      verificationState: "pending",
      confidenceState: "provisional",
      validity: "effective",
      authorityPolicyRef: null,
      applicationState: "not_applicable",
    });
    const { service, dateFacts } = await buildService({
      listFlowsWithNodes: vi.fn().mockResolvedValue(flows),
      listCurrentForNodeProjection: vi
        .fn()
        .mockResolvedValue([dateFact("c2", c2Time), dateFact("c1", c1Time)]),
    });

    const page = await service.execute({
      tenantId: "t1",
      containerIds: "c1,c2",
    });

    expect(page.items[0]?.nodes[0]?.times.plannedAt).toEqual(c1Time);
    expect(page.items[1]?.nodes[0]?.times.plannedAt).toEqual(c2Time);
    expect(dateFacts.listCurrentForNodeProjection).toHaveBeenCalledTimes(1);
    expect(dateFacts.listCurrentForNodeProjection).toHaveBeenCalledWith({
      tenantId: "t1",
      containerIds: ["c1", "c2"],
    });
  });
});
