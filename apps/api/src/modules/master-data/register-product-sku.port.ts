import type { RegisterProductSkuCommand } from "./domain/product-sku";

export const REGISTER_PRODUCT_SKU = Symbol("RegisterProductSku");

export interface RegisterProductSkuResult {
  productSkuId: string;
  productNumber: string;
  version: number;
  registrationState: "recorded" | "duplicate";
}

export interface RegisterProductSkuPort {
  execute(
    command: RegisterProductSkuCommand,
  ): Promise<RegisterProductSkuResult>;
}

export type { RegisterProductSkuCommand };
