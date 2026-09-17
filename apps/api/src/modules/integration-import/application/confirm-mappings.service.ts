import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";
import {
  isImportFieldCode,
  normalizeQuantityUnit,
} from "../domain/import-field-catalog";

export interface ConfirmMappingsInput {
  batchId: string;
  operatorId: string;
  tenantId: string;
  quantityUnit: string | null;
  reviews: { column: string; fieldCode: string | null }[];
}

// 映射确认（阶段 C）：人确认/修正列→字段，写入 import_review，批次转 confirmed。
@Injectable()
export class ConfirmMappingsService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
  ) {}

  async execute(input: ConfirmMappingsInput): Promise<void> {
    if (
      !Array.isArray(input.reviews) ||
      (input.quantityUnit !== null && typeof input.quantityUnit !== "string")
    ) {
      throw new BadRequestException("VALIDATION_MAPPING_REQUEST");
    }
    const result = await this.repository.findById(
      input.batchId,
      input.tenantId,
    );
    if (!result) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (!new Set(["parsed", "confirmed"]).has(result.batch.status)) {
      throw new ConflictException("BUSINESS_PRECONDITION_FAILED");
    }

    const columns = new Set(
      result.rows.length > 0 ? Object.keys(result.rows[0].values) : [],
    );
    const seenColumns = new Set<string>();
    const seenFields = new Set<string>();
    for (const review of input.reviews) {
      if (
        typeof review?.column !== "string" ||
        (review.fieldCode !== null && typeof review.fieldCode !== "string") ||
        !columns.has(review.column) ||
        seenColumns.has(review.column)
      ) {
        throw new BadRequestException("VALIDATION_MAPPING_COLUMN");
      }
      seenColumns.add(review.column);
      if (review.fieldCode !== null) {
        if (
          !isImportFieldCode(review.fieldCode) ||
          seenFields.has(review.fieldCode)
        ) {
          throw new BadRequestException("VALIDATION_MAPPING_FIELD");
        }
        seenFields.add(review.fieldCode);
      }
    }
    if (seenColumns.size !== columns.size) {
      throw new BadRequestException("VALIDATION_MAPPING_INCOMPLETE");
    }

    const quantityUnit = normalizeQuantityUnit(input.quantityUnit);
    if (input.quantityUnit && !quantityUnit) {
      throw new BadRequestException("VALIDATION_QUANTITY_UNIT");
    }
    if (quantityUnit && seenFields.has("quantityUnit")) {
      throw new BadRequestException("VALIDATION_QUANTITY_UNIT_SOURCE");
    }

    await this.repository.saveReviewDecision(
      input.batchId,
      quantityUnit,
      input.reviews.map((review) => ({
        ...review,
        operatorId: input.operatorId,
      })),
    );
  }
}
