import {
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
import { CreateImportBatchService } from "../application/create-import-batch.service";
import { GetImportBatchService } from "../application/get-import-batch.service";
import type { ImportBatch, ImportRow } from "../domain/import-batch";
import { DevIdentityGuard, type DevIdentity } from "./dev-identity.guard";
import {
  ImportBatchDetailDto,
  ImportBatchDto,
  ImportRowSampleDto,
} from "./import-batch.dto";

const SAMPLE_ROW_LIMIT = 20;

@ApiTags("import-batches")
@Controller("import-batches")
@UseGuards(DevIdentityGuard)
export class ImportBatchesController {
  constructor(
    private readonly createImportBatch: CreateImportBatchService,
    private readonly getImportBatch: GetImportBatchService,
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
}

function toBatchDto(batch: ImportBatch): ImportBatchDto {
  return {
    id: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    rowCount: batch.rowCount,
    columnCount: batch.columnCount,
    createdAt: batch.createdAt.toISOString(),
  };
}

function toRowDto(row: ImportRow): ImportRowSampleDto {
  return { rowNo: row.rowNo, values: row.values };
}

function extractColumns(rows: ImportRow[]): string[] {
  return rows.length > 0 ? Object.keys(rows[0].values) : [];
}
