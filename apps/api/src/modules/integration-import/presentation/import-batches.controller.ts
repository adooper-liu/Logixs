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
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ConfirmMappingsService } from "../application/confirm-mappings.service";
import { CreateImportBatchService } from "../application/create-import-batch.service";
import { ExecuteImportService } from "../application/execute-import.service";
import { GetImportBatchService } from "../application/get-import-batch.service";
import { RunPrecheckService } from "../application/run-precheck.service";
import type { ImportBatch, ImportRow } from "../domain/import-batch";
import type { ImportRowResultInput } from "../domain/import.repository";
import { DevIdentityGuard, type DevIdentity } from "./dev-identity.guard";
import {
  ConfirmMappingsRequestDto,
  ImportBatchDetailDto,
  ImportBatchDto,
  ImportRowSampleDto,
  PrecheckResultDto,
  ReconciliationResultDto,
} from "./import-batch.dto";

const SAMPLE_ROW_LIMIT = 20;

@ApiTags("import-batches")
@Controller("import-batches")
@UseGuards(DevIdentityGuard)
export class ImportBatchesController {
  constructor(
    private readonly createImportBatch: CreateImportBatchService,
    private readonly getImportBatch: GetImportBatchService,
    private readonly confirmMappings: ConfirmMappingsService,
    private readonly runPrecheck: RunPrecheckService,
    private readonly executeImport: ExecuteImportService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOkResponse({ type: ImportBatchDto })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Req() request: { devIdentity: DevIdentity },
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
      fileName: file.originalname,
      buffer: file.buffer,
      idempotencyKey,
      tenantId: request.devIdentity.tenantId,
      operatorId: request.devIdentity.operatorId,
    });
    return toBatchDto(batch);
  }

  @Get(":id")
  @ApiOkResponse({ type: ImportBatchDetailDto })
  async get(@Param("id") id: string): Promise<ImportBatchDetailDto> {
    const result = await this.getImportBatch.execute(id);
    if (!result) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return {
      batch: toBatchDto(result.batch),
      columns: extractColumns(result.rows),
      rows: result.rows.slice(0, SAMPLE_ROW_LIMIT).map(toRowDto),
    };
  }

  @Post(":id/mapping-reviews")
  @ApiOkResponse({ type: ImportBatchDto })
  async postMappingReviews(
    @Param("id") id: string,
    @Body() body: ConfirmMappingsRequestDto,
    @Req() request: { devIdentity: DevIdentity },
  ): Promise<ImportBatchDto> {
    await this.confirmMappings.execute({
      batchId: id,
      operatorId: request.devIdentity.operatorId,
      reviews: body.reviews,
    });
    const result = await this.getImportBatch.execute(id);
    if (!result) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return toBatchDto(result.batch);
  }

  @Post(":id/precheck")
  @ApiOkResponse({ type: PrecheckResultDto })
  async precheck(@Param("id") id: string): Promise<PrecheckResultDto> {
    return this.runPrecheck.execute(id);
  }

  @Post(":id/execute")
  @ApiOkResponse({ type: ReconciliationResultDto })
  async execute(@Param("id") id: string): Promise<ReconciliationResultDto> {
    const { results } = await this.executeImport.execute(id);
    return toReconciliationDto(results);
  }

  @Get(":id/reconciliation")
  @ApiOkResponse({ type: ReconciliationResultDto })
  async reconciliation(
    @Param("id") id: string,
  ): Promise<ReconciliationResultDto> {
    const { results } = await this.executeImport.getResults(id);
    return toReconciliationDto(results);
  }
}

function toBatchDto(batch: ImportBatch): ImportBatchDto {
  return {
    id: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    rowCount: batch.rowCount,
    columnCount: batch.columnCount,
    mappingSuggestions: batch.mappingSuggestions,
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
