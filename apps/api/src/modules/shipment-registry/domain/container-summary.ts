import type { ContainerLifecycleState } from "@logix/contracts";

// 只读投影的薄切片 DTO：container_record 的摘要，供列表接口返回。
// currentStatus 取值与 @logix/contracts 的 ContainerLifecycleState 严格一致（G7 显式映射 parity）。
export interface ContainerSummary {
  id: string;
  orderNumber: string;
  containerNumber: string | null;
  currentStatus: ContainerLifecycleState;
  updatedAt: string;
}
