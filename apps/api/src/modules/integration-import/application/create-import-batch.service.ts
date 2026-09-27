import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import standardImportCatalog from "@logix/contracts/post-departure-standard-import.json";
import type {
  ImportBatch,
  ImportMappingSuggestion,
  NewImportRow,
} from "../domain/import-batch";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";
import {
  IMPORT_SOURCE_STORAGE,
  type ImportSourceStorage,
} from "../domain/import-source-storage";
import { AiGatewayService } from "../../ai-governance";
import { isImportFieldCode } from "../domain/import-field-catalog";
import { detectMixedLayout } from "./import-layout-preflight";

export const MAX_IMPORT_SOURCE_BYTES = 10 * 1024 * 1024; // 10MB（NFR §3）
const MAX_ROWS = 5000; // NFR §3
const MAX_COLUMNS = 128; // NFR §3
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".csv"]);
const CONTENT_TYPES = {
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
// 改变表头、行快照或版式判定语义时必须升版，避免幂等命中旧解析结果。
const TABULAR_PARSER_VERSION = "tabular-v2";
export const STANDARD_POST_DEPARTURE_PARSER_VERSION =
  "post-departure-standard-v1";
export type ImportParserProfile = "tabular" | "post_departure_standard_v1";

export interface CreateImportBatchInput {
  fileName: string;
  buffer: Buffer;
  idempotencyKey: string;
  tenantId: string;
  operatorId: string;
  replacesBatchId?: string | null;
  parserProfile?: ImportParserProfile;
}

export interface CreateImportBatchResult {
  batch: ImportBatch;
  created: boolean; // false = 幂等命中，返回原批次
}

@Injectable()
export class CreateImportBatchService {
  private readonly logger = new Logger(CreateImportBatchService.name);

  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(IMPORT_SOURCE_STORAGE)
    private readonly sourceStorage: ImportSourceStorage,
    @Inject(AiGatewayService)
    private readonly aiGateway: AiGatewayService,
  ) {}

  async execute(
    input: CreateImportBatchInput,
  ): Promise<CreateImportBatchResult> {
    const ext = extname(input.fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new HttpException(
        "VALIDATION_FORMAT: 仅支持 .xlsx / .csv",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.buffer.length > MAX_IMPORT_SOURCE_BYTES) {
      throw new HttpException(
        "VALIDATION_RANGE: 文件超过 10MB",
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileHash = createHash("sha256").update(input.buffer).digest("hex");
    if (input.replacesBatchId) {
      const replaced = await this.repository.findById(
        input.replacesBatchId,
        input.tenantId,
      );
      if (!replaced) throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    const parserVersion =
      input.parserProfile === "post_departure_standard_v1"
        ? STANDARD_POST_DEPARTURE_PARSER_VERSION
        : TABULAR_PARSER_VERSION;
    const effectiveIdempotencyKey = buildParserScopedIdempotencyKey(
      input,
      parserVersion,
    );

    // 幂等：同 key 同 hash → 返回原批次；同 key 异 hash → 冲突
    const existing = await this.repository.findByIdempotencyKey(
      input.tenantId,
      effectiveIdempotencyKey,
    );
    if (existing) {
      if (existing.fileHash === fileHash) {
        return { batch: existing, created: false };
      }
      throw new ConflictException("IDEMPOTENCY_KEY_CONFLICT");
    }

    const { headers, rows } =
      input.parserProfile === "post_departure_standard_v1"
        ? await parseStandardPostDepartureWorkbook(input.buffer, ext)
        : await parseWorkbook(input.buffer, ext);
    if (rows.length > MAX_ROWS) {
      throw new HttpException(
        `VALIDATION_RANGE: 文件有 ${rows.length} 个数据行，最多支持 ${MAX_ROWS} 行`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (headers.length > MAX_COLUMNS) {
      throw new HttpException(
        `VALIDATION_RANGE: 文件有 ${headers.length} 列，最多支持 ${MAX_COLUMNS} 列`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const mappingSuggestions =
      input.parserProfile === "post_departure_standard_v1"
        ? []
        : await this.suggestMapping(headers);
    const batchId = randomUUID();
    const objectKey = `imports/${batchId}/source`;
    const contentType = CONTENT_TYPES[ext as keyof typeof CONTENT_TYPES];

    await this.sourceStorage.put({
      objectKey,
      contentType,
      contentLength: input.buffer.length,
      sha256: fileHash,
      body: input.buffer,
    });

    try {
      const batch = await this.repository.create(
        {
          id: batchId,
          tenantId: input.tenantId,
          operatorId: input.operatorId,
          idempotencyKey: effectiveIdempotencyKey,
          fileName: input.fileName,
          fileHash,
          sourceFileStatus: "retained",
          sourceObjectKey: objectKey,
          sourceContentType: contentType,
          sourceSizeBytes: input.buffer.length,
          sourceRetainedAt: new Date(),
          parserVersion,
          replacesBatchId: input.replacesBatchId ?? null,
          status: "parsed",
          rowCount: rows.length,
          columnCount: headers.length,
          mappingSuggestions,
        },
        rows,
      );
      return { batch, created: true };
    } catch (cause) {
      try {
        await this.sourceStorage.delete(objectKey);
      } catch (cleanupCause) {
        this.logger.error(
          JSON.stringify({
            event: "import_source_cleanup_failed",
            objectKey,
            error:
              cleanupCause instanceof Error
                ? cleanupCause.message
                : "unknown cleanup error",
          }),
        );
      }
      throw cause;
    }
  }

  // AI 建议（Mock）失败时降级为空建议，不阻断上传、不写业务表。
  private async suggestMapping(
    headers: string[],
  ): Promise<ImportMappingSuggestion[]> {
    try {
      return (await this.aiGateway.suggestImportMapping(headers)).map(
        (suggestion) => ({
          ...suggestion,
          fieldCode:
            suggestion.fieldCode && isImportFieldCode(suggestion.fieldCode)
              ? suggestion.fieldCode
              : null,
        }),
      );
    } catch {
      return [];
    }
  }
}

function buildParserScopedIdempotencyKey(
  input: Pick<CreateImportBatchInput, "idempotencyKey" | "replacesBatchId">,
  parserVersion: string,
): string {
  const replacementScope = input.replacesBatchId
    ? `:replaces:${input.replacesBatchId}`
    : "";
  return `${input.idempotencyKey}:parser:${parserVersion}${replacementScope}`;
}

async function parseStandardPostDepartureWorkbook(
  buffer: Buffer,
  ext: string,
): Promise<{ headers: string[]; rows: NewImportRow[] }> {
  if (ext !== ".xlsx") {
    throw new HttpException(
      "STANDARD_IMPORT_FORMAT_INVALID: 标准模板仅支持 .xlsx",
      HttpStatus.BAD_REQUEST,
    );
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const rows: NewImportRow[] = [];
  const allHeaders = new Set<string>([
    "__record_type",
    "__sheet_name",
    "__worksheet_row",
  ]);

  for (const sheetDefinition of standardImportCatalog.sheets) {
    const worksheet = workbook.getWorksheet(sheetDefinition.name);
    if (!worksheet) {
      if (!sheetDefinition.required) continue;
      throw new HttpException(
        `STANDARD_IMPORT_SHEET_MISSING:${sheetDefinition.name}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const actualLabels = sheetDefinition.fields.map((_, index) =>
      worksheet
        .getRow(1)
        .getCell(index + 1)
        .text.trim(),
    );
    const expectedLabels = sheetDefinition.fields.map(({ label }) => label);
    const hasUnexpectedHeader = Array.from(
      {
        length: Math.max(
          0,
          worksheet.getRow(1).cellCount - expectedLabels.length,
        ),
      },
      (_, index) =>
        worksheet
          .getRow(1)
          .getCell(expectedLabels.length + index + 1)
          .text.trim(),
    ).some(Boolean);
    if (
      hasUnexpectedHeader ||
      actualLabels.length !== expectedLabels.length ||
      actualLabels.some((label, index) => label !== expectedLabels[index])
    ) {
      throw new HttpException(
        `STANDARD_IMPORT_HEADERS_INVALID:${sheetDefinition.name}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    for (const field of sheetDefinition.fields) allHeaders.add(field.code);
    worksheet.eachRow((row, worksheetRowNo) => {
      if (worksheetRowNo === 1) return;
      const values = Object.fromEntries(
        sheetDefinition.fields.map((field, index) => [
          field.code,
          canonicalStandardReferenceSelection(
            field.code,
            row.getCell(index + 1).text.trim(),
          ),
        ]),
      );
      if (Object.values(values).every((value) => value === "")) return;
      const missing = sheetDefinition.fields.filter(
        (field) => field.required && !values[field.code],
      );
      if (missing.length > 0) {
        throw new HttpException(
          `STANDARD_IMPORT_REQUIRED_VALUE_MISSING:${sheetDefinition.name}:${worksheetRowNo}:${missing.map(({ label }) => label).join(",")}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      rows.push({
        rowNo: rows.length + 1,
        values: {
          __record_type: sheetDefinition.recordType,
          __sheet_name: sheetDefinition.name,
          __worksheet_row: String(worksheetRowNo),
          ...values,
        },
      });
    });
  }

  if (
    !rows.some(({ values }) => values.__record_type === "shipment_container")
  ) {
    throw new HttpException(
      "STANDARD_IMPORT_EMPTY: 已出运接管页至少需要一行",
      HttpStatus.BAD_REQUEST,
    );
  }
  return { headers: [...allHeaders], rows };
}

function canonicalStandardReferenceSelection(
  fieldCode: string,
  value: string,
): string {
  const pattern =
    fieldCode === "sales_country_code"
      ? /^([A-Z]{2})\s*\|/
      : fieldCode === "origin_port_code" ||
          fieldCode === "destination_port_code"
        ? /^([A-Z]{2}[A-Z0-9]{3})\s*\|/
        : undefined;
  if (!pattern) return value;
  return pattern.exec(value.toUpperCase())?.[1] ?? value;
}

async function parseWorkbook(
  buffer: Buffer,
  ext: string,
): Promise<{ headers: string[]; rows: NewImportRow[] }> {
  const workbook = new ExcelJS.Workbook();
  // exceljs 的 csv.read 运行时要求 Stream（调用 stream.pipe）；xlsx.load 接受 Buffer。
  if (ext === ".csv") {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as never);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new HttpException(
      "VALIDATION_FORMAT: 未找到工作表",
      HttpStatus.BAD_REQUEST,
    );
  }

  // 第一行为列头；空列头给占位名，保证 key 唯一
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const text = cell.text.trim();
    headers[colNumber - 1] = text || `column_${colNumber}`;
  });
  if (headers.length === 0) {
    throw new HttpException(
      "VALIDATION_FORMAT: 空文件",
      HttpStatus.BAD_REQUEST,
    );
  }

  const rows: NewImportRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 跳过表头
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = row.getCell(index + 1).text.trim();
      values[header] = value;
    });
    rows.push({ rowNo: rowNumber - 1, values });
  });

  const mixedLayout = detectMixedLayout(headers, rows);
  if (mixedLayout) {
    throw new HttpException(
      `VALIDATION_LAYOUT: 疑似混合版式，工作表第 ${mixedLayout.worksheetRowNo} 行起出现纵向字段值区块`,
      HttpStatus.BAD_REQUEST,
    );
  }

  return { headers, rows };
}
