import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  RegisterProductSkuPort,
  RegisterProductSkuResult,
} from "../register-product-sku.port";
import {
  normalizeRegisterProductSkuCommand,
  ProductSkuCommandError,
  type RegisterProductSkuCommand,
} from "../domain/product-sku";
import {
  PRODUCT_SKU_REPOSITORY,
  ProductSkuIdempotencyConflictError,
  type ProductSkuRepository,
} from "../domain/product-sku.repository";

@Injectable()
export class RegisterProductSkuService implements RegisterProductSkuPort {
  constructor(
    @Inject(PRODUCT_SKU_REPOSITORY)
    private readonly repository: ProductSkuRepository,
  ) {}

  async execute(
    command: RegisterProductSkuCommand,
  ): Promise<RegisterProductSkuResult> {
    let normalized;
    try {
      normalized = normalizeRegisterProductSkuCommand(command);
    } catch (error) {
      if (error instanceof ProductSkuCommandError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    try {
      const saved = await this.repository.register(normalized);
      return {
        productSkuId: saved.record.productSkuId,
        productNumber: saved.record.productNumber,
        version: saved.record.version,
        registrationState: saved.duplicate ? "duplicate" : "recorded",
      };
    } catch (error) {
      if (error instanceof ProductSkuIdempotencyConflictError) {
        throw new ConflictException("MASTER_DATA_IDEMPOTENCY_CONFLICT");
      }
      throw error;
    }
  }
}
