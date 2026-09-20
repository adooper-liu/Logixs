import type {
  BindReplenishmentLineProductSkuCommand,
  BoundReplenishmentLineProductSku,
} from "./domain/replenishment-line-sku-binding";

export const BIND_REPLENISHMENT_LINE_PRODUCT_SKU = Symbol(
  "BindReplenishmentLineProductSku",
);

export interface BindReplenishmentLineProductSkuPort {
  execute(
    command: BindReplenishmentLineProductSkuCommand,
  ): Promise<BoundReplenishmentLineProductSku>;
}

export type {
  BindReplenishmentLineProductSkuCommand,
  BoundReplenishmentLineProductSku,
};
