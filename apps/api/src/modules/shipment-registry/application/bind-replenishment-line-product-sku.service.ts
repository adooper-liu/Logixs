import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GET_PRODUCT_SKU, type GetProductSkuPort } from "../../master-data";
import type { BindReplenishmentLineProductSkuPort } from "../bind-replenishment-line-product-sku.port";
import {
  normalizeBindReplenishmentLineProductSkuCommand,
  ReplenishmentLineNotFoundError,
  ReplenishmentLineSkuBindingConflictError,
  ReplenishmentLineSkuBindingValidationError,
  type BindReplenishmentLineProductSkuCommand,
  type BoundReplenishmentLineProductSku,
} from "../domain/replenishment-line-sku-binding";
import {
  REPLENISHMENT_LINE_SKU_BINDER,
  type ReplenishmentLineSkuBinder,
} from "../domain/replenishment-line-sku-binding.repository";

@Injectable()
export class BindReplenishmentLineProductSkuService implements BindReplenishmentLineProductSkuPort {
  constructor(
    @Inject(GET_PRODUCT_SKU)
    private readonly getProductSku: GetProductSkuPort,
    @Inject(REPLENISHMENT_LINE_SKU_BINDER)
    private readonly binder: ReplenishmentLineSkuBinder,
  ) {}

  async execute(
    command: BindReplenishmentLineProductSkuCommand,
  ): Promise<BoundReplenishmentLineProductSku> {
    let normalized;
    try {
      normalized = normalizeBindReplenishmentLineProductSkuCommand(command);
    } catch (error) {
      if (error instanceof ReplenishmentLineSkuBindingValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const productSku = await this.getProductSku.execute({
      tenantId: normalized.tenantId,
      productSkuId: normalized.productSkuId,
    });
    if (!productSku) {
      throw new NotFoundException("PRODUCT_SKU_NOT_FOUND");
    }
    if (productSku.productNumber !== normalized.productNumber) {
      throw new ConflictException("PRODUCT_SKU_NUMBER_MISMATCH");
    }

    try {
      return await this.binder.bind(normalized);
    } catch (error) {
      if (error instanceof ReplenishmentLineNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ReplenishmentLineSkuBindingConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
