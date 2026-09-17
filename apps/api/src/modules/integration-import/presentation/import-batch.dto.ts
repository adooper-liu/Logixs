import { ApiProperty } from "@nestjs/swagger";
import type { ImportFieldCatalog } from "@logix/contracts/import-fields.json";

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

  @ApiProperty({
    description: "原始文件留存状态：not_retained | retained",
  })
  sourceFileStatus!: string;

  @ApiProperty({ nullable: true, description: "原始文件字节数" })
  sourceSizeBytes!: number | null;

  @ApiProperty({ description: "生成该批快照的解析器版本" })
  parserVersion!: string;

  @ApiProperty({
    nullable: true,
    description: "本批次替代的旧导入批次 ID",
  })
  replacesBatchId!: string | null;

  @ApiProperty({
    description:
      "批次状态：parsed | confirmed | approved | executing | completed",
  })
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

  @ApiProperty({ nullable: true, description: "人工确认的整批数量单位" })
  confirmedQuantityUnit!: string | null;

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

  @ApiProperty({ type: [ImportMappingSuggestionDto] })
  effectiveMappings!: ImportMappingSuggestionDto[];

  @ApiProperty({ description: "字段与数量单位目录" })
  fieldCatalog!: ImportFieldCatalog;
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

  @ApiProperty({ nullable: true, description: "人工确认的整批数量单位码" })
  quantityUnit!: string | null;
}

export class PrecheckBlockerDto {
  @ApiProperty({ description: "稳定规则码（如 REQ_ORDER / HEADER_CONFLICT）" })
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
