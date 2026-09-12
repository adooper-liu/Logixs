import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApplyContainerRecordService } from "../../shipment-registry";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
  type ImportRowResultInput,
} from "../domain/import.repository";
import { columnForField } from "./mapping.util";

// 落账（阶段 C）：逐行经 shipment-registry 写端口写 container_record，记录行结果。
// 只读映射建议，不直写业务表；失败/重复不阻断其他行。
@Injectable()
export class ExecuteImportService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(ApplyContainerRecordService)
    private readonly applyContainerRecord: ApplyContainerRecordService,
  ) {}

  async execute(batchId: string): Promise<{ results: ImportRowResultInput[] }> {
    const result = await this.repository.findById(batchId);
    if (!result) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const { batch, rows } = result;

    // 预检硬闸：只有 approved（预检无 blocker）才可落账，服务端强制。
    if (batch.status !== "approved") {
      throw new HttpException(
        "BUSINESS_PRECONDITION_FAILED: 预检未通过，禁止落账",
        HttpStatus.CONFLICT,
      );
    }

    const orderColumn = columnForField(batch.mappingSuggestions, "orderNumber");
    const containerColumn = columnForField(
      batch.mappingSuggestions,
      "containerNumber",
    );

    await this.repository.updateStatus(batchId, "executing");

    const results: ImportRowResultInput[] = [];
    const seenOrderNumbers = new Set<string>();

    for (const row of rows) {
      const orderNumber = orderColumn
        ? (row.values[orderColumn] ?? "").trim()
        : "";
      const containerNumber = containerColumn
        ? (row.values[containerColumn] ?? "").trim()
        : "";

      if (!orderNumber) {
        results.push({
          rowId: row.id,
          outcome: "failed",
          containerRecordId: null,
          detail: "缺备货单号",
        });
        continue;
      }
      if (seenOrderNumbers.has(orderNumber)) {
        results.push({
          rowId: row.id,
          outcome: "duplicate",
          containerRecordId: null,
          detail: "文件内重复",
        });
        continue;
      }
      seenOrderNumbers.add(orderNumber);

      try {
        const applied = await this.applyContainerRecord.execute({
          tenantId: batch.tenantId,
          orderNumber,
          containerNumber: containerNumber || null,
          currentStatus: "shipped",
        });
        results.push({
          rowId: row.id,
          outcome: "success",
          containerRecordId: applied.containerRecordId,
          detail: null,
        });
      } catch (cause) {
        results.push({
          rowId: row.id,
          outcome: "failed",
          containerRecordId: null,
          detail: cause instanceof Error ? cause.message : "写端口失败",
        });
      }
    }

    await this.repository.saveRowResults(batchId, results);
    await this.repository.updateStatus(batchId, "completed");
    return { results };
  }

  async getResults(batchId: string): Promise<{
    results: ImportRowResultInput[];
  }> {
    return { results: await this.repository.getRowResults(batchId) };
  }
}
