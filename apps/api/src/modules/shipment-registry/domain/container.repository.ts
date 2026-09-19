import type { ContainerSummary } from "./container-summary";
import type { ContainerTaskFact } from "./container-task-fact";

// 读端口（Port/Adapter）：Application 依赖此抽象，Infrastructure 用 Prisma 实现。
// 用 Symbol 作 DI 令牌，因为 interface 在运行时不具备身份。
export const CONTAINER_REPOSITORY = Symbol("ContainerRepository");

export interface ContainerListQuery {
  tenantId: string;
  after?: { updatedAt: Date; id: string };
  take: number;
}

export interface ContainerByIdQuery {
  tenantId: string;
  id: string;
}

export interface ContainerByNumberQuery {
  tenantId: string;
  containerNumber: string;
  take: number;
}

export interface ContainerRepository {
  list(query: ContainerListQuery): Promise<ContainerSummary[]>;
  findById(query: ContainerByIdQuery): Promise<ContainerSummary | null>;
  findTenantId(containerId: string): Promise<string | null>;
  findIdsByContainerNumber(query: ContainerByNumberQuery): Promise<string[]>;
  listCurrentTaskFacts(query: ContainerByIdQuery): Promise<ContainerTaskFact[]>;
}
