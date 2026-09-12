import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";

export interface ConfirmMappingsInput {
  batchId: string;
  operatorId: string;
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
    const result = await this.repository.findById(input.batchId);
    if (!result) throw new NotFoundException("RESOURCE_NOT_FOUND");

    await this.repository.saveReviews(
      input.batchId,
      input.reviews.map((review) => ({
        ...review,
        operatorId: input.operatorId,
      })),
    );
    await this.repository.updateStatus(input.batchId, "confirmed");
  }
}
