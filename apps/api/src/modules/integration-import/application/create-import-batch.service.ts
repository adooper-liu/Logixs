import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import type {
  ImportBatch,
  ImportMappingSuggestion,
  ImportRow,
} from "../domain/import-batch";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";
import { AiGatewayService } from "../../ai-governance";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB（NFR §3）
const MAX_ROWS = 5000; // NFR §3
const MAX_COLUMNS = 50; // NFR §3
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".csv"]);

export interface CreateImportBatchInput {
  fileName: string;
  buffer: Buffer;
  idempotencyKey: string;
  tenantId: string;
  operatorId: string;
}

export interface CreateImportBatchResult {
  batch: ImportBatch;
  created: boolean; // false = 幂等命中，返回原批次
}

@Injectable()
export class CreateImportBatchService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
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
    if (input.buffer.length > MAX_SIZE) {
      throw new HttpException(
        "VALIDATION_RANGE: 文件超过 10MB",
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileHash = createHash("sha256").update(input.buffer).digest("hex");

    // 幂等：同 key 同 hash → 返回原批次；同 key 异 hash → 冲突
    const existing = await this.repository.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.fileHash === fileHash) {
        return { batch: existing, created: false };
      }
      throw new ConflictException("IDEMPOTENCY_KEY_CONFLICT");
    }

    const { headers, rows } = await parseWorkbook(input.buffer, ext);
    if (headers.length > MAX_COLUMNS || rows.length > MAX_ROWS) {
      throw new HttpException(
        "VALIDATION_RANGE: 超出 5000 行 / 50 列上限",
        HttpStatus.BAD_REQUEST,
      );
    }

    const mappingSuggestions = await this.suggestMapping(headers);

    const batch = await this.repository.create(
      {
        tenantId: input.tenantId,
        operatorId: input.operatorId,
        idempotencyKey: input.idempotencyKey,
        fileName: input.fileName,
        fileHash,
        status: "parsed",
        rowCount: rows.length,
        columnCount: headers.length,
        mappingSuggestions,
      },
      rows,
    );
    return { batch, created: true };
  }

  // AI 建议（Mock）失败时降级为空建议，不阻断上传、不写业务表。
  private async suggestMapping(
    headers: string[],
  ): Promise<ImportMappingSuggestion[]> {
    try {
      return await this.aiGateway.suggestImportMapping(headers);
    } catch {
      return [];
    }
  }
}

async function parseWorkbook(
  buffer: Buffer,
  ext: string,
): Promise<{ headers: string[]; rows: ImportRow[] }> {
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

  const rows: ImportRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 跳过表头
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = row.getCell(index + 1).text.trim();
    });
    rows.push({ rowNo: rowNumber - 1, values });
  });

  return { headers, rows };
}
