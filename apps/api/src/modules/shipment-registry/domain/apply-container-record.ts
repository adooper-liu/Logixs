// 货柜记录写端口（Port/Adapter）：integration-import 经此写 container_record，禁止直写。
export const CONTAINER_RECORD_WRITER = Symbol("ContainerRecordWriter");

export interface ApplyContainerRecordCommand {
  tenantId: string;
  orderNumber: string; // 匹配主锚
  containerNumber: string | null; // 迟绑定，可空
  currentStatus: "shipped"; // 阶段 C 建档统一 shipped（导入即已出运货柜）
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
