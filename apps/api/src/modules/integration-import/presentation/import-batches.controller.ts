import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { isUtf8 } from "node:buffer";
import { ConfirmMappingsService } from "../application/confirm-mappings.service";
import {
  CreateImportBatchService,
  MAX_IMPORT_SOURCE_BYTES,
} from "../application/create-import-batch.service";
import { ExecuteImportService } from "../application/execute-import.service";
import { GetImportBatchService } from "../application/get-import-batch.service";
import { RunPrecheckService } from "../application/run-precheck.service";
import type { ImportBatch, ImportRow } from "../domain/import-batch";
import { IMPORT_FIELD_CATALOG } from "../domain/import-field-catalog";
import type { ImportRowResultInput } from "../domain/import.repository";
import { effectiveMappings } from "../application/mapping.util";
import {
  ConfirmMappingsRequestDto,
  ImportBatchDetailDto,
  ImportBatchDto,
  ImportRowSampleDto,
  PrecheckResultDto,
  ReconciliationResultDto,
} from "./import-batch.dto";

const SAMPLE_ROW_LIMIT = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeMultipartFileName(fileName: string): string {
  if ([...fileName].some((character) => character.codePointAt(0)! > 255)) {
    return fileName;
  }
  const bytes = Buffer.from(fileName, "latin1");
  return isUtf8(bytes) ? bytes.toString("utf8") : fileName;
}

export function normalizeReplacementBatchId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new HttpException(
      "VALIDATION_FORMAT: replacesBatchId 必须是 UUID",
      HttpStatus.BAD_REQUEST,
    );
  }
  return value;
}

@ApiTags("import-batches")
@Controller("import-batches")
export class ImportBatchesController {
  constructor(
    private readonly createImportBatch: CreateImportBatchService,
    private readonly getImportBatch: GetImportBatchService,
    private readonly confirmMappings: ConfirmMappingsService,
    private readonly runPrecheck: RunPrecheckService,
    private readonly executeImport: ExecuteImportService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { files: 1, fileSize: MAX_IMPORT_SOURCE_BYTES },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
        replacesBatchId: { type: "string", format: "uuid", nullable: true },
      },
    },
  })
  @ApiOkResponse({ type: ImportBatchDto })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("replacesBatchId") replacesBatchId: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ImportBatchDto> {
    if (!file) {
      throw new HttpException(
        "VALIDATION_REQUIRED: 缺少文件",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!idempotencyKey) {
      throw new HttpException(
        "VALIDATION_REQUIRED: 缺少 Idempotency-Key",
        HttpStatus.BAD_REQUEST,
      );
    }
    const { batch } = await this.createImportBatch.execute({
      fileName: normalizeMultipartFileName(file.originalname),
      buffer: file.buffer,
      idempotencyKey,
      tenantId: request.identity.tenantId,
      operatorId: request.identity.actorId,
      replacesBatchId: normalizeReplacementBatchId(replacesBatchId),
    });
    return toBatchDto(batch);
  }

  @Get(":id")
  @ApiOkResponse({ type: ImportBatchDetailDto })
  async get(
    @Param("id") id: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<ImportBatchDetailDto> {
    const result = await this.getImportBatch.execute(
      id,
      request.identity.tenantId,
    );
    if (!result) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return {
      batch: toBatchDto(result.batch),
      columns: extractColumns(result.rows),
      rows: result.rows.slice(0, SAMPLE_ROW_LIMIT).map(toRowDto),
      effectiveMappings: effectiveMappings(result.batch, result.reviews),
      fieldCatalog: IMPORT_FIELD_CATALOG,
    };
  }

  @Post(":id/mapping-reviews")
  @ApiOkResponse({ type: ImportBatchDto })
  async postMappingReviews(
    @Param("id") id: string,
    @Body() body: ConfirmMappingsRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ImportBatchDto> {
    await this.confirmMappings.execute({
      batchId: id,
      operatorId: request.identity.actorId,
      tenantId: request.identity.tenantId,
      quantityUnit: body.quantityUnit,
      reviews: body.reviews,
    });
    const result = await this.getImportBatch.execute(
      id,
      request.identity.tenantId,
    );
    if (!result) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return toBatchDto(result.batch);
  }

  @Post(":id/precheck")
  @ApiOkResponse({ type: PrecheckResultDto })
  async precheck(
    @Param("id") id: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<PrecheckResultDto> {
    return this.runPrecheck.execute(id, request.identity.tenantId);
  }

  @Post(":id/execute")
  @ApiOkResponse({ type: ReconciliationResultDto })
  async execute(
    @Param("id") id: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<ReconciliationResultDto> {
    const { results } = await this.executeImport.execute(
      id,
      request.identity.tenantId,
    );
    return toReconciliationDto(results);
  }

  @Get(":id/reconciliation")
  @ApiOkResponse({ type: ReconciliationResultDto })
  async reconciliation(
    @Param("id") id: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<ReconciliationResultDto> {
    const { results } = await this.executeImport.getResults(
      id,
      request.identity.tenantId,
    );
    return toReconciliationDto(results);
  }
}

export function toBatchDto(batch: ImportBatch): ImportBatchDto {
  return {
    id: batch.id,
    fileName: batch.fileName,
    sourceFileStatus: batch.sourceFileStatus,
    sourceSizeBytes: batch.sourceSizeBytes,
    parserVersion: batch.parserVersion,
    replacesBatchId: batch.replacesBatchId,
    status: batch.status,
    rowCount: batch.rowCount,
    columnCount: batch.columnCount,
    mappingSuggestions: batch.mappingSuggestions,
    confirmedQuantityUnit: batch.confirmedQuantityUnit,
    createdAt: batch.createdAt.toISOString(),
  };
}

function toRowDto(row: ImportRow): ImportRowSampleDto {
  return { rowNo: row.rowNo, values: row.values };
}

function extractColumns(rows: ImportRow[]): string[] {
  return rows.length > 0 ? Object.keys(rows[0].values) : [];
}

function toReconciliationDto(
  results: ImportRowResultInput[],
): ReconciliationResultDto {
  return {
    results: results.map((result) => ({
      rowId: result.rowId,
      outcome: result.outcome,
      containerRecordId: result.containerRecordId,
      detail: result.detail,
    })),
    success: results.filter((result) => result.outcome === "success").length,
    failed: results.filter((result) => result.outcome === "failed").length,
    duplicate: results.filter((result) => result.outcome === "duplicate")
      .length,
  };
}
