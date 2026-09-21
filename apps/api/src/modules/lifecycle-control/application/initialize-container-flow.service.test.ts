import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LIST_CONTAINER_TASK_FACTS } from "../../shipment-registry";
import { CREATE_NODE_TASK } from "../../work-execution";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { InitializeContainerFlowService } from "./initialize-container-flow.service";

const nodes = [
  {
    id: "node-ready",
    nodeCode: "cargo_ready" as const,
    state: "active",
    completedAt: null,
    applicability: "required" as const,
  },
  {
    id: "node-customs",
    nodeCode: "customs_clearance" as const,
    state: "pending",
    completedAt: null,
    applicability: "required" as const,
  },
];

async function buildService(containerNumber: string | null) {
  const repository = {
    findContainerBase: vi.fn().mockResolvedValue({
      tenantId: "tenant-1",
      orderNumber: "SO-1",
      containerNumber,
      currentStatus: "not_shipped",
    }),
    ensureFlow: vi.fn().mockResolvedValue({
      flow: {
        id: "flow-1",
        containerId: "container-1",
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 0,
      },
      nodes,
    }),
  };
  const listFacts = {
    execute: vi.fn().mockResolvedValue([
      {
        id: "fact-1",
        factCode: "customs_clearance_completed",
        eventCode: "container_customs_completed",
        nodeCode: "customs_clearance",
        timeKind: "actual",
        captureSource: "controlled_import",
        evidenceRef: "11111111-1111-4111-8111-111111111111",
      },
    ]),
  };
  const createNodeTask = {
    execute: vi.fn().mockImplementation((input) =>
      Promise.resolve({
        task: { id: `task-${input.nodeCode}` },
        workOrders: [],
        outcome: null,
      }),
    ),
  };
  const module = await Test.createTestingModule({
    providers: [
      InitializeContainerFlowService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
      { provide: LIST_CONTAINER_TASK_FACTS, useValue: listFacts },
      { provide: CREATE_NODE_TASK, useValue: createNodeTask },
    ],
  }).compile();
  return {
    service: module.get(InitializeContainerFlowService),
    repository,
    listFacts,
    createNodeTask,
  };
}

describe("InitializeContainerFlowService", () => {
  it("有真实箱号时展开完整节点任务并携带先行事实", async () => {
    const { service, repository, listFacts, createNodeTask } =
      await buildService("MSKU1234567");

    const result = await service.execute({
      containerId: "container-1",
      tenantId: "tenant-1",
    });

    expect(result).toEqual({ initialized: true, taskCount: 2 });
    expect(repository.ensureFlow).toHaveBeenCalledWith("container-1");
    expect(listFacts.execute).toHaveBeenCalledWith({
      containerId: "container-1",
      tenantId: "tenant-1",
    });
    expect(createNodeTask.execute).toHaveBeenCalledTimes(2);
    expect(createNodeTask.execute).toHaveBeenCalledWith({
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-customs",
      nodeCode: "customs_clearance",
      containerId: "container-1",
      tenantId: "tenant-1",
      applicability: "required",
      isCurrent: false,
      conditionFacts: [expect.objectContaining({ id: "fact-1" })],
    });
  });

  it("无箱号备货单不伪造货柜流程", async () => {
    const { service, repository, listFacts, createNodeTask } =
      await buildService(null);

    await expect(
      service.execute({ containerId: "container-1", tenantId: "tenant-1" }),
    ).resolves.toEqual({ initialized: false, taskCount: 0 });
    expect(repository.ensureFlow).not.toHaveBeenCalled();
    expect(listFacts.execute).not.toHaveBeenCalled();
    expect(createNodeTask.execute).not.toHaveBeenCalled();
  });
});
