import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ListContainerCurrentNodesService } from "./list-container-current-nodes.service";

async function buildService(overrides?: {
  listCurrentNodes?: ReturnType<typeof vi.fn>;
}) {
  const repository = {
    findFlowByContainer: vi.fn(),
    listCurrentNodes:
      overrides?.listCurrentNodes ?? vi.fn().mockResolvedValue([]),
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
  const module = await Test.createTestingModule({
    providers: [
      ListContainerCurrentNodesService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return {
    service: module.get(ListContainerCurrentNodesService),
    repository,
  };
}

describe("ListContainerCurrentNodesService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const { service, repository } = await buildService();
    await expect(service.execute({ containerIds: "c1" })).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(repository.listCurrentNodes).not.toHaveBeenCalled();
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });

  it("空 ID → VALIDATION_REQUIRED", async () => {
    const { service, repository } = await buildService();
    await expect(
      service.execute({ tenantId: "t1", containerIds: "" }),
    ).rejects.toThrow("VALIDATION_REQUIRED");
    expect(repository.listCurrentNodes).not.toHaveBeenCalled();
  });

  it("只返回仓库给出的已有流程，不写库", async () => {
    const { service, repository } = await buildService({
      listCurrentNodes: vi.fn().mockResolvedValue([
        {
          containerId: "c1",
          currentNodeCode: "shipment_dispatch",
          flowState: "active",
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
        currentNodeCode: "shipment_dispatch",
        flowState: "active",
      },
    ]);
    expect(repository.listCurrentNodes).toHaveBeenCalledWith({
      tenantId: "t1",
      containerIds: ["c1", "c2"],
    });
    expect(repository.ensureFlow).not.toHaveBeenCalled();
  });
});
