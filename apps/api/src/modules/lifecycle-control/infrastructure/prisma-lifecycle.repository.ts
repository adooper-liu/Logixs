import { Inject, Injectable } from "@nestjs/common";
import type { LifecycleNodeCode } from "@logix/contracts";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  FlowWithNodes,
  LifecycleRepository,
} from "../domain/lifecycle.repository";

@Injectable()
export class PrismaLifecycleRepository implements LifecycleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findFlowByContainer(
    containerId: string,
  ): Promise<FlowWithNodes | null> {
    const flow = await this.prisma.flowInstance.findUnique({
      where: { containerId },
      include: { nodes: true },
    });
    if (!flow) return null;
    return toFlowWithNodes(flow);
  }

  async ensureFlow(containerId: string): Promise<FlowWithNodes> {
    const existing = await this.prisma.flowInstance.findUnique({
      where: { containerId },
      include: { nodes: true },
    });
    if (existing) return toFlowWithNodes(existing);

    const flow = await this.prisma.flowInstance.create({
      data: {
        containerId,
        state: "active",
        currentNodeCode: "cargo_ready",
        nodes: {
          create: [{ nodeCode: "cargo_ready", state: "active" }],
        },
      },
      include: { nodes: true },
    });
    return toFlowWithNodes(flow);
  }

  async completeNodes(
    flowInstanceId: string,
    nodeCodes: LifecycleNodeCode[],
    occurredAt: Date,
  ): Promise<void> {
    for (const nodeCode of nodeCodes) {
      await this.prisma.nodeInstance.upsert({
        where: {
          flowInstanceId_nodeCode: { flowInstanceId, nodeCode },
        },
        create: {
          flowInstanceId,
          nodeCode,
          state: "completed",
          completedAt: occurredAt,
        },
        update: { state: "completed", completedAt: occurredAt },
      });
    }
  }

  async updateCurrentNode(
    flowInstanceId: string,
    nodeCode: LifecycleNodeCode,
  ): Promise<void> {
    await this.prisma.flowInstance.update({
      where: { id: flowInstanceId },
      data: { currentNodeCode: nodeCode },
    });
  }

  async findContainerBase(containerId: string): Promise<{
    tenantId: string;
    orderNumber: string;
    containerNumber: string | null;
    currentStatus: string;
  } | null> {
    const container = await this.prisma.containerRecord.findUnique({
      where: { id: containerId },
    });
    if (!container) return null;
    return {
      tenantId: container.tenantId,
      orderNumber: container.orderNumber,
      containerNumber: container.containerNumber,
      currentStatus: container.currentStatus,
    };
  }
}

function toFlowWithNodes(flow: {
  id: string;
  containerId: string;
  state: string;
  currentNodeCode: string;
  nodes: { nodeCode: string; state: string; completedAt: Date | null }[];
}): FlowWithNodes {
  return {
    flow: {
      id: flow.id,
      containerId: flow.containerId,
      state: flow.state,
      currentNodeCode: flow.currentNodeCode,
    },
    nodes: flow.nodes.map((node) => ({
      nodeCode: node.nodeCode as LifecycleNodeCode,
      state: node.state,
      completedAt: node.completedAt,
    })),
  };
}
