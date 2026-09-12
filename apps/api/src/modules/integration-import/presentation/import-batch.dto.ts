import { ApiProperty } from "@nestjs/swagger";

export class ImportMappingSuggestionDto {
  @ApiProperty({ description: "原始列头" })
  column!: string;

  @ApiProperty({
    description: "建议的标准字段码（null=待人工）",
    nullable: true,
  })
  fieldCode!: string | null;

  @ApiProperty({ description: "置信度 0~1" })
  confidence!: number;
}

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

  @ApiProperty({
    description: "AI 字段映射建议",
    type: [ImportMappingSuggestionDto],
  })
  mappingSuggestions!: ImportMappingSuggestionDto[];

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

export class MappingReviewInputDto {
  @ApiProperty({ description: "原始列头" })
  column!: string;

  @ApiProperty({
    description: "确认/修正后的字段码（null=跳过该列）",
    nullable: true,
  })
  fieldCode!: string | null;
}

export class ConfirmMappingsRequestDto {
  @ApiProperty({ type: [MappingReviewInputDto] })
  reviews!: MappingReviewInputDto[];
}

export class PrecheckBlockerDto {
  @ApiProperty({ description: "规则码（如 REQ_ORDER / DUP_ROW）" })
  ruleCode!: string;

  @ApiProperty({ description: "行号（null=批次级）", nullable: true })
  rowNo!: number | null;

  @ApiProperty({ description: "说明" })
  message!: string;
}

export class PrecheckResultDto {
  @ApiProperty({ type: [PrecheckBlockerDto] })
  blockers!: PrecheckBlockerDto[];
}

export class ImportRowResultDto {
  @ApiProperty() rowId!: string;
  @ApiProperty({ description: "success | failed | duplicate" })
  outcome!: string;
  @ApiProperty({ nullable: true }) containerRecordId!: string | null;
  @ApiProperty({ nullable: true }) detail!: string | null;
}

export class ReconciliationResultDto {
  @ApiProperty({ type: [ImportRowResultDto] })
  results!: ImportRowResultDto[];

  @ApiProperty() success!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() duplicate!: number;
}
