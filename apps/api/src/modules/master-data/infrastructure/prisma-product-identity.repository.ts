import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ProductIdentityConflictError,
  type PreparedProductIdentityDraft,
} from "../domain/product-identity";
import type {
  IdentityQueueEntry,
  ProductIdentityRecord,
  ProductIdentityRepository,
  ProductSkuIdentityRecord,
} from "../domain/product-identity.repository";

type Transaction = Prisma.TransactionClient;
type ProductRow = Prisma.ProductGetPayload<{
  include: {
    skus: true;
    releases: { orderBy: { version: "desc" }; take: 1 };
  };
}>;

export class ProductIdentityNotFoundError extends Error {}

/**
 * 产品与 SKU 身份的仓储。
 *
 * 两处容易踩的地方，写在前面：
 *
 * 1. **SKU 编号是租户级唯一的**（既有 `product_sku_tenant_number_key`），
 *    跨产品也不能重号 —— 不是"同一产品下唯一"。撞号时给明确错误，不静默吞掉。
 * 2. **从产品下移走的 SKU 是"解除归属"而不是删除**：下游的 ShipmentCargoLine
 *    可能在引用它们，删了会断链，也会被外键拦住。
 */
@Injectable()
export class PrismaProductIdentityRepository implements ProductIdentityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listQueue(
    input: Parameters<ProductIdentityRepository["listQueue"]>[0],
  ): Promise<IdentityQueueEntry[]> {
    const rows = await this.prisma.productDefinitionRelease.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.after
          ? {
              OR: [
                { releasedAt: { lt: input.after.releasedAt } },
                {
                  AND: [
                    { releasedAt: input.after.releasedAt },
                    { id: { lt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ releasedAt: "desc" }, { id: "desc" }],
      take: input.take,
      include: { products: { select: { id: true, productNumber: true } } },
    });
    return rows.map((row) => ({
      releaseId: row.id,
      definitionId: row.definitionId,
      specification: row.specification,
      npiStage: row.npiStage,
      releasedBy: row.releasedBy,
      releasedAt: row.releasedAt,
      productId: row.products[0]?.id ?? null,
      productNumber: row.products[0]?.productNumber ?? null,
    }));
  }

  async findBySourceHandoffId(
    tenantId: string,
    sourceHandoffId: string,
  ): Promise<ProductIdentityRecord | null> {
    const row = await this.prisma.product.findUnique({
      where: { tenantId_sourceHandoffId: { tenantId, sourceHandoffId } },
      include: PRODUCT_INCLUDE,
    });
    return row ? toRecord(row) : null;
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ProductIdentityRecord | null> {
    const row = await this.prisma.product.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: PRODUCT_INCLUDE,
    });
    return row ? toRecord(row) : null;
  }

  persistDraft(
    input: Parameters<ProductIdentityRepository["persistDraft"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-identity:${input.tenantId}:${input.sourceHandoffId}`,
      );

      const replay = await this.findRowByIdempotencyKey(
        tx,
        input.tenantId,
        command.idempotencyKey,
      );
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("PRODUCT_IDENTITY_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }

      const release = await tx.productDefinitionRelease.findFirst({
        where: { id: input.sourceHandoffId, tenantId: input.tenantId },
        select: { id: true },
      });
      if (!release) {
        throw new ProductIdentityNotFoundError(
          "PRODUCT_IDENTITY_RELEASE_NOT_FOUND",
        );
      }

      const existing = await tx.product.findUnique({
        where: {
          tenantId_sourceHandoffId: {
            tenantId: input.tenantId,
            sourceHandoffId: input.sourceHandoffId,
          },
        },
      });
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        conflict("PRODUCT_IDENTITY_VERSION_CONFLICT");
      }

      const productId = existing?.id ?? randomUUID();
      const data = {
        productNumber: command.productNumber,
        attributes: command.attributes as unknown as Prisma.InputJsonValue,
        version: command.version,
        specification: input.specification,
        actedBy: input.actorId,
        idempotencyKey: command.idempotencyKey,
        payloadHash: command.payloadHash,
        updatedAt: new Date(),
      };
      if (existing) {
        await tx.product.update({ where: { id: productId }, data });
      } else {
        await tx.product.create({
          data: {
            id: productId,
            tenantId: input.tenantId,
            sourceHandoffId: input.sourceHandoffId,
            ...data,
          },
        });
      }
      await this.syncSkus(tx, input.tenantId, productId, command);

      // SKU 同步完再读一次：返回的记录必须带上刚写进去的那些 SKU。
      const refreshed = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: PRODUCT_INCLUDE,
      });
      return { record: toRecord(refreshed), duplicate: false };
    });
  }

  persistRelease(
    input: Parameters<ProductIdentityRepository["persistRelease"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-identity:release:${input.tenantId}:${input.productId}`,
      );

      const replay = await this.findRowByIdempotencyKey(
        tx,
        input.tenantId,
        command.idempotencyKey,
      );
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("PRODUCT_IDENTITY_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }

      const existing = await tx.product.findUnique({
        where: { id: input.productId },
        include: { skus: true },
      });
      if (!existing || existing.tenantId !== input.tenantId) {
        throw new ProductIdentityNotFoundError("PRODUCT_IDENTITY_NOT_FOUND");
      }
      if (existing.version !== command.expectedVersion) {
        conflict("PRODUCT_IDENTITY_VERSION_CONFLICT");
      }

      const row = await tx.product.update({
        where: { id: existing.id },
        data: {
          version: command.version,
          actedBy: input.actorId,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
          updatedAt: new Date(),
        },
        include: PRODUCT_INCLUDE,
      });

      // 发布：追加不可变交接快照，冻结此刻的身份与属性。
      const snapshotVersion =
        (await tx.productIdentityRelease.count({
          where: { tenantId: input.tenantId, productId: existing.id },
        })) + 1;
      await tx.productIdentityRelease.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          productId: existing.id,
          version: snapshotVersion,
          productNumber: existing.productNumber,
          skus: existing.skus.map((sku) => ({
            skuId: sku.id,
            skuCode: sku.productNumber,
            attributes: sku.attributes ?? {},
          })) as unknown as Prisma.InputJsonValue,
          pendingFieldCodes: command.pendingFieldCodes,
          releasedBy: input.actorId,
          releasedAt: row.updatedAt,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
      });

      return { record: toRecord(row), duplicate: false };
    });
  }

  /**
   * 把命令里的 SKU 同步到产品下：带上 skuId 的更新（认同一行），没带的建新行，
   * **命令里不再列出的解除归属**（不删 —— 下游可能在引用）。
   */
  private async syncSkus(
    tx: Transaction,
    tenantId: string,
    productId: string,
    command: PreparedProductIdentityDraft,
  ): Promise<void> {
    const kept: string[] = [];
    for (const sku of command.skus) {
      const attributes = sku.attributes as unknown as Prisma.InputJsonValue;
      if (sku.skuId) {
        await this.updateSku(tx, sku.skuId, {
          productId,
          productNumber: sku.skuCode,
          attributes,
        });
        kept.push(sku.skuId);
      } else {
        const created = await this.createSku(tx, {
          tenantId,
          productId,
          productNumber: sku.skuCode,
          attributes,
        });
        kept.push(created);
      }
    }
    await tx.productSku.updateMany({
      where: { tenantId, productId, id: { notIn: kept } },
      data: { productId: null },
    });
  }

  private async createSku(
    tx: Transaction,
    data: {
      tenantId: string;
      productId: string;
      productNumber: string;
      attributes: Prisma.InputJsonValue;
    },
  ): Promise<string> {
    const id = randomUUID();
    try {
      await tx.productSku.create({ data: { id, ...data } });
    } catch (error) {
      throw translateSkuError(error);
    }
    return id;
  }

  private async updateSku(
    tx: Transaction,
    id: string,
    data: {
      productId: string;
      productNumber: string;
      attributes: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    try {
      await tx.productSku.update({ where: { id }, data });
    } catch (error) {
      throw translateSkuError(error);
    }
  }

  private findRowByIdempotencyKey(
    tx: Transaction,
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ProductRow | null> {
    return tx.product.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: PRODUCT_INCLUDE,
    });
  }
}

const PRODUCT_INCLUDE = {
  skus: { orderBy: { createdAt: "asc" } },
  releases: { orderBy: { version: "desc" }, take: 1 },
} satisfies Prisma.ProductInclude;

/**
 * SKU 编号是**租户级唯一**的（既有约束），撞号是业务上要人处理的冲突，
 * 不是技术故障 —— 翻成明确的冲突码，别让调用方看到一个数据库异常。
 */
function translateSkuError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new ProductIdentityConflictError("PRODUCT_IDENTITY_SKU_CODE_TAKEN");
  }
  return error;
}

function toRecord(row: ProductRow): ProductIdentityRecord {
  return {
    productId: row.id,
    sourceHandoffId: row.sourceHandoffId,
    productNumber: row.productNumber,
    version: row.version,
    specification: row.specification,
    attributes:
      row.attributes as unknown as ProductIdentityRecord["attributes"],
    skus: row.skus.map(toSkuRecord),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSkuRecord(row: {
  id: string;
  productNumber: string;
  attributes: Prisma.JsonValue;
}): ProductSkuIdentityRecord {
  return {
    skuId: row.id,
    skuCode: row.productNumber,
    attributes: (row.attributes ??
      {}) as unknown as ProductSkuIdentityRecord["attributes"],
  };
}

async function advisoryLock(tx: Transaction, key: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function conflict(code: string): never {
  throw new ProductIdentityConflictError(code);
}
