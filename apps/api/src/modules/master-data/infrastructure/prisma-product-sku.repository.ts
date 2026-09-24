import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { NormalizedRegisterProductSkuCommand } from "../domain/product-sku";
import {
  ProductSkuIdempotencyConflictError,
  type ProductSkuRecord,
  type ProductSkuRepository,
} from "../domain/product-sku.repository";

@Injectable()
export class PrismaProductSkuRepository implements ProductSkuRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(input: {
    tenantId: string;
    productSkuId: string;
  }): Promise<ProductSkuRecord | null> {
    const productSku = await this.prisma.productSku.findUnique({
      where: {
        id_tenantId: { id: input.productSkuId, tenantId: input.tenantId },
      },
      select: {
        id: true,
        tenantId: true,
        productNumber: true,
        version: true,
      },
    });
    return productSku ? toRecord(productSku) : null;
  }

  async findByProductNumbers(input: {
    tenantId: string;
    productNumbers: string[];
  }): Promise<ProductSkuRecord[]> {
    const rows = await this.prisma.productSku.findMany({
      where: {
        tenantId: input.tenantId,
        productNumber: { in: input.productNumbers },
      },
      orderBy: { productNumber: "asc" },
      select: {
        id: true,
        tenantId: true,
        productNumber: true,
        version: true,
      },
    });
    return rows.map(toRecord);
  }

  register(input: NormalizedRegisterProductSkuCommand): Promise<{
    record: ProductSkuRecord;
    duplicate: boolean;
  }> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT 1 AS "lockAcquired"
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`product-sku-registration:${input.tenantId}:${input.idempotencyKey}`}, 0)
          )
        ) AS acquired
      `;

      const existingRegistration =
        await transaction.productSkuRegistration.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: {
            payloadHash: true,
            productSku: {
              select: {
                id: true,
                tenantId: true,
                productNumber: true,
                version: true,
              },
            },
          },
        });
      if (existingRegistration) {
        if (existingRegistration.payloadHash !== input.payloadHash) {
          throw new ProductSkuIdempotencyConflictError();
        }
        return {
          record: toRecord(existingRegistration.productSku),
          duplicate: true,
        };
      }

      const productSku = await transaction.productSku.upsert({
        where: {
          tenantId_productNumber: {
            tenantId: input.tenantId,
            productNumber: input.productNumber,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: input.tenantId,
          productNumber: input.productNumber,
        },
        update: {},
        select: {
          id: true,
          tenantId: true,
          productNumber: true,
          version: true,
        },
      });
      await transaction.productSkuRegistration.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          productSkuId: productSku.id,
        },
      });
      return { record: toRecord(productSku), duplicate: false };
    });
  }
}

function toRecord(input: {
  id: string;
  tenantId: string;
  productNumber: string;
  version: number;
}): ProductSkuRecord {
  return {
    productSkuId: input.id,
    tenantId: input.tenantId,
    productNumber: input.productNumber,
    version: input.version,
  };
}
