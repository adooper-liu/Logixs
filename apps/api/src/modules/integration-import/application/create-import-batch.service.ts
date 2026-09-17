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
const IMPORT_PARSER_VERSION = "tabular-v2";

export interface CreateImportBatchInput {
  fileName: string;
  buffer: Buffer;
  idempotencyKey: string;
  tenantId: string;
  operatorId: string;
  replacesBatchId?: string | null;
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
    const effectiveIdempotencyKey = buildParserScopedIdempotencyKey(input);

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

    const { headers, rows } = await parseWorkbook(input.buffer, ext);
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

    const mappingSuggestions = await this.suggestMapping(headers);
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
          parserVersion: IMPORT_PARSER_VERSION,
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
): string {
  const replacementScope = input.replacesBatchId
    ? `:replaces:${input.replacesBatchId}`
    : "";
  return `${input.idempotencyKey}:parser:${IMPORT_PARSER_VERSION}${replacementScope}`;
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
