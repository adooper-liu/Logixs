// 货柜记录写端口（Port/Adapter）：integration-import / lifecycle-control 经此写 container_record，禁止直写。
import type { ContainerLifecycleState } from "@logix/contracts";

export const CONTAINER_RECORD_WRITER = Symbol("ContainerRecordWriter");

export interface ApplyContainerRecordCommand {
  tenantId: string;
  containerRecordId: string; // 稳定货柜 ID；状态推进禁止按箱号反查
  containerNumber: string | null; // 迟绑定，可空
  currentStatus: ContainerLifecycleState; // 8 态（导入建档 shipped；状态推进传任意合法态）
}

export interface ApplyContainerRecordResult {
  containerRecordId: string;
  created: boolean; // true=新建，false=命中更新
}

export interface ContainerRecordWriter {
  apply(
    command: ApplyContainerRecordCommand,
  ): Promise<ApplyContainerRecordResult>;
}
