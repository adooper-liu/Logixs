import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";
import { mapImportRow } from "./import-row-mapper";
import { normalizeSourceDateTime, mappedTimeValue } from "./import-time-facts";
import {
  IMPORT_FIELD_CATALOG,
  IMPORT_TIME_FACT_CATALOG,
  isCompletedTimeStatus,
  type ImportFieldCode,
} from "../domain/import-field-catalog";
import { columnForField, effectiveMappings } from "./mapping.util";
import { detectMixedLayout } from "./import-layout-preflight";

export interface PrecheckBlocker {
  ruleCode: string;
  rowNo: number | null;
  message: string;
}

@Injectable()
export class RunPrecheckService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
  ) {}

  async execute(
    batchId: string,
    tenantId: string,
  ): Promise<{ blockers: PrecheckBlocker[] }> {
    const result = await this.repository.findById(batchId, tenantId);
    if (!result) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const { batch, rows, reviews } = result;
    if (!new Set(["confirmed", "approved"]).has(batch.status)) {
      throw new ConflictException("BUSINESS_PRECONDITION_FAILED");
    }

    const mixedLayout = detectMixedLayout(
      Object.keys(rows[0]?.values ?? {}),
      rows,
    );
    if (mixedLayout) {
      return {
        blockers: [
          {
            ruleCode: "LAYOUT_MIXED",
            rowNo: mixedLayout.rowNo,
            message: `疑似混合版式，工作表第 ${mixedLayout.worksheetRowNo} 行起出现纵向字段值区块`,
          },
        ],
      };
    }

    const mappings = effectiveMappings(batch, reviews);
    const blockers: PrecheckBlocker[] = [];
    const hasOrderMapping = Boolean(columnForField(mappings, "orderNumber"));
    const hasProductMapping = Boolean(
      columnForField(mappings, "productNumber"),
    );
    const hasQuantityMapping = Boolean(
      columnForField(mappings, "shippedQuantity"),
    );
    const hasUnitSource = Boolean(columnForField(mappings, "quantityUnit"));
    const requiredMappings = [
      ["orderNumber", "REQ_ORDER", "未确认备货单号列"],
      ["productNumber", "REQ_PRODUCT", "未确认产品货号列"],
      ["shippedQuantity", "REQ_QTY", "未确认出运数量列"],
    ] as const;
    for (const [fieldCode, ruleCode, message] of requiredMappings) {
      if (!columnForField(mappings, fieldCode)) {
        blockers.push({ ruleCode, rowNo: null, message });
      }
    }
    if (
      !batch.confirmedQuantityUnit &&
      !columnForField(mappings, "quantityUnit")
    ) {
      blockers.push({
        ruleCode: "REQ_QTY_UNIT",
        rowNo: null,
        message: "必须映射数量单位列或人工确认整批数量单位",
      });
    }

    const headerValuesByOrder = new Map<string, Map<ImportFieldCode, string>>();
    const rowsByOrder = new Map<string, typeof rows>();
    const seenBusinessLines = new Map<string, number>();
    for (const row of rows) {
      const mapped = mapImportRow(batch, row, mappings);
      if (hasOrderMapping && !mapped.orderNumber) {
        blockers.push({
          ruleCode: "REQ_ORDER",
          rowNo: row.rowNo,
          message: `第 ${row.rowNo} 行缺备货单号`,
        });
      }
      if (hasProductMapping && !mapped.productNumber) {
        blockers.push({
          ruleCode: "REQ_PRODUCT",
          rowNo: row.rowNo,
          message: `第 ${row.rowNo} 行缺产品货号`,
        });
      }
      if (hasQuantityMapping && !mapped.shippedQuantity) {
        blockers.push({
          ruleCode: "REQ_QTY",
          rowNo: row.rowNo,
          message: `第 ${row.rowNo} 行出运数量必须为正数`,
        });
      }
      if (
        (hasUnitSource || batch.confirmedQuantityUnit) &&
        !mapped.quantityUnit
      ) {
        blockers.push({
          ruleCode: "REQ_QTY_UNIT",
          rowNo: row.rowNo,
          message: `第 ${row.rowNo} 行缺少有效数量单位`,
        });
      }

      if (mapped.orderNumber) {
        const groupedRows = rowsByOrder.get(mapped.orderNumber) ?? [];
        groupedRows.push(row);
        rowsByOrder.set(mapped.orderNumber, groupedRows);

        const knownHeaders =
          headerValuesByOrder.get(mapped.orderNumber) ??
          new Map<ImportFieldCode, string>();
        for (const field of IMPORT_FIELD_CATALOG.fields) {
          if (field.scope !== "header" || field.code === "orderNumber") {
            continue;
          }
          const value = mappedTimeValue(row, mappings, field.code);
          if (!value) continue;
          const known = knownHeaders.get(field.code);
          if (known && known !== value) {
            blockers.push({
              ruleCode: "HEADER_CONFLICT",
              rowNo: row.rowNo,
              message: `备货单 ${mapped.orderNumber} 的${field.label}不一致`,
            });
          } else if (!known) {
            knownHeaders.set(field.code, value);
          }
        }
        headerValuesByOrder.set(mapped.orderNumber, knownHeaders);
      }

      if (
        mapped.orderNumber &&
        mapped.productNumber &&
        mapped.shippedQuantity &&
        mapped.quantityUnit
      ) {
        const duplicateKey = JSON.stringify([
          mapped.orderNumber,
          mapped.productNumber,
          mapped.shippedQuantity,
          mapped.quantityUnit,
          mapped.contractNumber,
        ]);
        const firstRow = seenBusinessLines.get(duplicateKey);
        if (firstRow !== undefined) {
          blockers.push({
            ruleCode: "DUP_ROW",
            rowNo: row.rowNo,
            message: `第 ${row.rowNo} 行与第 ${firstRow} 行业务明细重复`,
          });
        } else {
          seenBusinessLines.set(duplicateKey, row.rowNo);
        }
      }
    }

    for (const [orderNumber, orderRows] of rowsByOrder) {
      for (const definition of IMPORT_TIME_FACT_CATALOG) {
        const value = firstNonEmpty(
          orderRows,
          mappings,
          definition.timeFieldCode,
        );
        const status = definition.statusFieldCode
          ? firstNonEmpty(orderRows, mappings, definition.statusFieldCode)
          : "";
        const statusCompleted = Boolean(
          status && isCompletedTimeStatus(definition, status),
        );

        if (definition.timeKind === "actual") {
          if (statusCompleted !== Boolean(value)) {
            blockers.push({
              ruleCode: "ACTUAL_EVIDENCE",
              rowNo: orderRows[0]?.rowNo ?? null,
              message: `备货单 ${orderNumber} 的${definition.label}必须同时有完成状态和实际时间`,
            });
          }
          if (!value) continue;
          if (!statusCompleted) {
            blockers.push({
              ruleCode: "ACTUAL_EVIDENCE",
              rowNo: orderRows[0]?.rowNo ?? null,
              message: `备货单 ${orderNumber} 的${definition.label}缺少已确认的完成语义`,
            });
          }
        } else if (!value) {
          continue;
        }

        const sourceSystem = firstNonEmpty(
          orderRows,
          mappings,
          "timeSourceSystem",
        );
        const sourceUtcOffset = firstNonEmpty(
          orderRows,
          mappings,
          "timeSourceUtcOffset",
        );
        if (!sourceSystem || !sourceUtcOffset) {
          blockers.push({
            ruleCode: "TIME_PROVENANCE",
            rowNo: orderRows[0]?.rowNo ?? null,
            message: `备货单 ${orderNumber} 的${definition.label}缺来源系统或 UTC 偏移`,
          });
        }
        if (value && !normalizeSourceDateTime(value, sourceUtcOffset)) {
          blockers.push({
            ruleCode: "FMT_TIME",
            rowNo: orderRows[0]?.rowNo ?? null,
            message: `备货单 ${orderNumber} 的${definition.label}无法按明确 UTC 偏移解析`,
          });
        }
        if (definition.requiresEvidence) {
          const evidenceRef = firstNonEmpty(
            orderRows,
            mappings,
            "timeEvidenceRef",
          );
          if (!UUID_PATTERN.test(evidenceRef)) {
            blockers.push({
              ruleCode: "ACTUAL_EVIDENCE",
              rowNo: orderRows[0]?.rowNo ?? null,
              message: `备货单 ${orderNumber} 的${definition.label}缺有效证据 ID`,
            });
          }
        }
        if (
          definition.requiresDerivationRule &&
          !firstNonEmpty(orderRows, mappings, "timeDerivationRuleVersion")
        ) {
          blockers.push({
            ruleCode: "DERIVED_NOT_ACTUAL",
            rowNo: orderRows[0]?.rowNo ?? null,
            message: `备货单 ${orderNumber} 的${definition.label}缺推导规则版本`,
          });
        }
      }
    }

    if (blockers.length === 0) {
      await this.repository.updateStatus(batchId, "approved");
    }
    return { blockers };
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstNonEmpty(
  rows: { values: Record<string, string> }[],
  mappings: { column: string; fieldCode: string | null }[],
  fieldCode: ImportFieldCode,
): string {
  for (const row of rows) {
    const value = mappedTimeValue(row as never, mappings, fieldCode);
    if (value) return value;
  }
  return "";
}
