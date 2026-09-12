import { ApiProperty } from "@nestjs/swagger";
import type { ContainerLifecycleState } from "@logix/contracts";

// 只读投影 DTO（presentation 层）：Swagger 文档用，domain 层不依赖 swagger。
export class ContainerSummaryDto {
  @ApiProperty({
    description: "货柜记录 ID（UUID）",
    example: "10000000-0000-4000-8000-000000000001",
  })
  id!: string;

  @ApiProperty({ description: "备货单号（匹配主锚）", example: "SO-2026-0001" })
  orderNumber!: string;

  @ApiProperty({
    description: "箱号（迟绑定，装箱后才有，可空）",
    example: "MSKU1234567",
    nullable: true,
    type: String,
  })
  containerNumber!: string | null;

  @ApiProperty({
    description: "货柜当前阶段（8 态，与 ContainerLifecycleState 一致）",
    enum: [
      "not_shipped",
      "shipped",
      "in_transit",
      "at_port",
      "picked_up",
      "unloaded",
      "returned_empty",
      "cancelled",
    ],
    example: "in_transit",
  })
  currentStatus!: ContainerLifecycleState;

  @ApiProperty({ description: "更新时间（ISO 8601 UTC）" })
  updatedAt!: string;
}
