import type { ContainerSummary } from "./container-summary";

// 读端口（Port/Adapter）：Application 依赖此抽象，Infrastructure 用 Prisma 实现。
// 用 Symbol 作 DI 令牌，因为 interface 在运行时不具备身份。
export const CONTAINER_REPOSITORY = Symbol("ContainerRepository");

export interface ContainerRepository {
  list(): Promise<ContainerSummary[]>;
}
