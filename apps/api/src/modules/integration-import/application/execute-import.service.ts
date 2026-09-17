import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApplyReplenishmentOrderImportService } from "../../shipment-registry";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
  type ImportRowResultInput,
} from "../domain/import.repository";
import { mapImportRow, type MappedImportRow } from "./import-row-mapper";
import { collectImportTimeFacts } from "./import-time-facts";
import { effectiveMappings } from "./mapping.util";

@Injectable()
export class ExecuteImportService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(ApplyReplenishmentOrderImportService)
    private readonly applyOrderImport: ApplyReplenishmentOrderImportService,
  ) {}

  async execute(
    batchId: string,
    tenantId: string,
  ): Promise<{ results: ImportRowResultInput[] }> {
    const result = await this.repository.findById(batchId, tenantId);
    if (!result) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const { batch, rows, reviews } = result;
    if (batch.status !== "approved") {
      throw new ConflictException(
        "BUSINESS_PRECONDITION_FAILED: 预检未通过，禁止落账",
      );
    }

    const mappings = effectiveMappings(batch, reviews);
    const grouped = new Map<string, MappedImportRow[]>();
    for (const row of rows) {
      const mapped = mapImportRow(batch, row, mappings);
      const group = grouped.get(mapped.orderNumber) ?? [];
      group.push(mapped);
      grouped.set(mapped.orderNumber, group);
    }

    await this.repository.updateStatus(batchId, "executing");
    const reconciliation: ImportRowResultInput[] = [];

    for (const [orderNumber, orderRows] of grouped) {
      try {
        const firstContainerNumber =
          orderRows.find(({ containerNumber }) => containerNumber)
            ?.containerNumber ?? null;
        const applied = await this.applyOrderImport.execute({
          tenantId: batch.tenantId,
          sourceBatchId: batch.id,
          orderNumber,
          containerNumber: firstContainerNumber,
          lines: orderRows.map((row) => {
            if (!row.quantityUnit) {
              throw new ConflictException("PRECHECK_INVARIANT_VIOLATION");
            }
            return {
              sourceRowId: row.sourceRowId,
              productNumber: row.productNumber,
              shippedQuantity: row.shippedQuantity,
              quantityUnit: row.quantityUnit,
              contractNumber: row.contractNumber,
            };
          }),
          timeFacts: collectImportTimeFacts(
            rows.filter((source) =>
              orderRows.some((mapped) => mapped.sourceRowId === source.id),
            ),
            mappings,
          ),
        });
        reconciliation.push(
          ...orderRows.map((row) => ({
            rowId: row.sourceRowId,
            outcome: "success" as const,
            containerRecordId: applied.containerRecordId,
            detail: null,
          })),
        );
      } catch (cause) {
        reconciliation.push(
          ...orderRows.map((row) => ({
            rowId: row.sourceRowId,
            outcome: "failed" as const,
            containerRecordId: null,
            detail: cause instanceof Error ? cause.message : "写端口失败",
          })),
        );
      }
    }

    await this.repository.saveRowResults(batchId, reconciliation);
    await this.repository.updateStatus(batchId, "completed");
    return { results: reconciliation };
  }

  async getResults(
    batchId: string,
    tenantId: string,
  ): Promise<{ results: ImportRowResultInput[] }> {
    const batch = await this.repository.findById(batchId, tenantId);
    if (!batch) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return { results: await this.repository.getRowResults(batchId) };
  }
}
