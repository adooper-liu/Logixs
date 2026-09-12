import { ApiProperty } from "@nestjs/swagger";

export class ImportBatchDto {
  @ApiProperty({ description: "批次 ID（UUID）" })
  id!: string;

  @ApiProperty({ description: "原始文件名" })
  fileName!: string;

  @ApiProperty({ description: "批次状态（阶段 A：pending | parsed）" })
  status!: string;

  @ApiProperty({ description: "数据行数" })
  rowCount!: number;

  @ApiProperty({ description: "列数" })
  columnCount!: number;

  @ApiProperty({ description: "创建时间（ISO 8601 UTC）" })
  createdAt!: string;
}

export class ImportRowSampleDto {
  @ApiProperty({ description: "行号（从 1 开始）" })
  rowNo!: number;

  @ApiProperty({ description: "各列值（原始列头 → 单元格文本）" })
  values!: Record<string, string>;
}

export class ImportBatchDetailDto {
  @ApiProperty({ description: "批次摘要" })
  batch!: ImportBatchDto;

  @ApiProperty({ description: "列头（解析出的第一行）", type: [String] })
  columns!: string[];

  @ApiProperty({ description: "前若干行样本", type: [ImportRowSampleDto] })
  rows!: ImportRowSampleDto[];
}
