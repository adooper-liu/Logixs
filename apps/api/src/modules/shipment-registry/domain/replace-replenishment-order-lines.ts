export type ReplenishmentOrderProjectionLine = {
  sourceRowId: string;
  productNumber: string;
  shippedQuantity: string;
  quantityUnit: "piece" | "set";
  contractNumber: string | null;
};

export type ReplaceReplenishmentOrderLinesCommand = {
  tenantId: string;
  sourceBatchId: string;
  expectedCurrentSourceBatchId?: string;
  orderNumber: string;
  lines: ReplenishmentOrderProjectionLine[];
};

export const REPLACE_REPLENISHMENT_ORDER_LINES = Symbol(
  "REPLACE_REPLENISHMENT_ORDER_LINES",
);

export interface ReplaceReplenishmentOrderLinesPort {
  execute(command: ReplaceReplenishmentOrderLinesCommand): Promise<void>;
  executeBatch(
    commands: ReplaceReplenishmentOrderLinesCommand[],
  ): Promise<void>;
}
