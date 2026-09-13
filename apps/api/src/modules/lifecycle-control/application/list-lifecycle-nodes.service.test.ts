import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ListLifecycleNodesService } from "./list-lifecycle-nodes.service";

async function buildService(overrides?: {
  findContainerBase?: ReturnType<typeof vi.fn>;
  findFlowByContainer?: ReturnType<typeof vi.fn>;
}) {
  const repository = {
    findFlowByContainer:
      overrides?.findFlowByContainer ?? vi.fn().mockResolvedValue(null),
    ensureFlow: vi.fn(),
    completeNodes: vi.fn(),
    updateCurrentNode: vi.fn(),
    ensureNode: vi.fn(),
    findContainerBase:
      overrides?.findContainerBase ??
      vi.fn().mockResolvedValue({
        tenantId: "t1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "in_transit",
      }),
    findEventByIdempotencyKey: vi.fn(),
    listEvents: vi.fn(),
    saveEvent: vi.fn(),
    findLatestEventTime: vi.fn(),
    findApplicabilityDecision: vi.fn(),
    applyNodeApplicability: vi.fn(),
  };
  const module = await Test.createTestingModule({
    providers: [
      ListLifecycleNodesService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return {
    service: module.get(ListLifecycleNodesService),
    repository,
  };
}

describe("ListLifecycleNodesService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const { service, repository } = await buildService();
    await expect(service.execute({ containerId: "c1" })).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(repository.findFlowByContainer).not.toHaveBeenCalled();
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });

  it("货柜不存在或跨租户 → RESOURCE_NOT_FOUND", async () => {
    const { service, repository } = await buildService({
      findContainerBase: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.execute({ tenantId: "t1", containerId: "missing" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(repository.findFlowByContainer).not.toHaveBeenCalled();
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });

  it("无流程返回空节点且不写库", async () => {
    const { service, repository } = await buildService();
    const page = await service.execute({ tenantId: "t1", containerId: "c1" });
    expect(page.flow).toBeNull();
    expect(page.nodes).toEqual([]);
    expect(page.projectionVersion).toBe(0);
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });

  it("有流程只返回已落库节点", async () => {
    const { service, repository } = await buildService({
      findFlowByContainer: vi.fn().mockResolvedValue({
        flow: {
          id: "f1",
          containerId: "c1",
          state: "active",
          currentNodeCode: "cargo_ready",
          version: 0,
        },
        nodes: [
          {
            id: "n1",
            nodeCode: "cargo_ready",
            state: "active",
            completedAt: null,
            applicability: "required",
          },
        ],
      }),
    });
    const page = await service.execute({ tenantId: "t1", containerId: "c1" });
    expect(page.flow?.id).toBe("f1");
    expect(page.nodes).toEqual([
      {
        nodeInstanceId: "n1",
        nodeCode: "cargo_ready",
        sequence: 1,
        state: "active",
        applicability: "required",
        completedAt: null,
        isCurrent: true,
      },
    ]);
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });
});
