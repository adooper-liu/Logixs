import type {
  BoundReplenishmentLineProductSku,
  NormalizedBindReplenishmentLineProductSkuCommand,
} from "./replenishment-line-sku-binding";

export const REPLENISHMENT_LINE_SKU_BINDER = Symbol(
  "ReplenishmentLineSkuBinder",
);

export interface ReplenishmentLineSkuBinder {
  bind(
    command: NormalizedBindReplenishmentLineProductSkuCommand,
  ): Promise<BoundReplenishmentLineProductSku>;
}
