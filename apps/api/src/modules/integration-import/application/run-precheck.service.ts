import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";
import { columnForField } from "./mapping.util";

export interface PrecheckBlocker {
  ruleCode: string;
  rowNo: number | null;
  message: string;
}

// 预检硬闸（阶段 C）：最小 O 级 blocker——REQ_ORDER（缺备货单号）、DUP_ROW（文件内重复）。
// 无 blocker 时批次转 approved；有 blocker 则禁执行。
@Injectable()
export class RunPrecheckService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
  ) {}

  async execute(batchId: string): Promise<{ blockers: PrecheckBlocker[] }> {
    const result = await this.repository.findById(batchId);
    if (!result) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const { batch, rows } = result;

    const orderColumn = columnForField(batch.mappingSuggestions, "orderNumber");
    const blockers: PrecheckBlocker[] = [];

    if (!orderColumn) {
      blockers.push({
        ruleCode: "REQ_ORDER",
        rowNo: null,
        message: "未识别备货单号列",
      });
    } else {
      const seen = new Map<string, number>();
      for (const row of rows) {
        const orderNumber = (row.values[orderColumn] ?? "").trim();
        if (!orderNumber) {
          blockers.push({
            ruleCode: "REQ_ORDER",
            rowNo: row.rowNo,
            message: `第 ${row.rowNo} 行缺备货单号`,
          });
        } else if (seen.has(orderNumber)) {
          blockers.push({
            ruleCode: "DUP_ROW",
            rowNo: row.rowNo,
            message: `备货单号 ${orderNumber} 文件内重复`,
          });
        } else {
          seen.set(orderNumber, row.rowNo);
        }
      }
    }

    if (blockers.length === 0) {
      await this.repository.updateStatus(batchId, "approved");
    }
    return { blockers };
  }
}
