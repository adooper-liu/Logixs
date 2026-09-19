export const REPLENISHMENT_ORDER_IMPORT_WRITER = Symbol(
  "ReplenishmentOrderImportWriter",
);

export interface ReplenishmentOrderImportLine {
  sourceRowId: string;
  productNumber: string;
  shippedQuantity: string;
  quantityUnit: QuantityUnitCode;
  contractNumber: string | null;
}

export interface ShipmentTimeFactImport {
  sourceRowId: string;
  factCode:
    | "customs_clearance_completed"
    | "container_unloading_completed"
    | "container_empty_confirmed"
    | "container_empty_estimated";
  timeKind: "actual" | "estimated";
  captureSource: "controlled_import" | "system_derived";
  eventCode: string | null;
  rawValue: string;
  occurredAtUtc: Date;
  sourceUtcOffset: string;
  sourceSystem: string;
  authoritySystem: string;
  sourceStatus: string | null;
  evidenceRef: string | null;
  derivationRuleVersion: string | null;
  nodeCode: string | null;
  mappingVersion: string;
}

export interface ApplyReplenishmentOrderImportCommand {
  tenantId: string;
  sourceBatchId: string;
  orderNumber: string;
  containerNumber: string | null;
  lines: ReplenishmentOrderImportLine[];
  timeFacts: ShipmentTimeFactImport[];
}

export interface ApplyReplenishmentOrderImportResult {
  replenishmentOrderId: string;
  containerRecordId: string;
  created: boolean;
}

export interface ReplenishmentOrderImportWriter {
  apply(
    command: ApplyReplenishmentOrderImportCommand,
  ): Promise<ApplyReplenishmentOrderImportResult>;
}
import type { QuantityUnitCode } from "@logix/contracts/import-fields.json";
