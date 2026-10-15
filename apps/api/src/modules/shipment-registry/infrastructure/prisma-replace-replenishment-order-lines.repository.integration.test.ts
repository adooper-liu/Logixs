import { describe, expect, it } from "vitest";
import { ListReplenishmentOrdersService } from "../application/list-replenishment-orders.service";
import type { ReplaceReplenishmentOrderLinesCommand } from "../domain/replace-replenishment-order-lines";
import { withTemporaryDatabase } from "../../../tools/full-chain-demo/integration-support";
import { PrismaReplenishmentOrderWorkbenchRepository } from "./prisma-replenishment-order-workbench.repository";
import { PrismaReplaceReplenishmentOrderLinesRepository } from "./prisma-replace-replenishment-order-lines.repository";

function command(
  sourceBatchId: string,
  lines: ReplaceReplenishmentOrderLinesCommand["lines"],
  tenantId = "demo-real-sample-20260921",
  orderNumber = "CR-001",
): ReplaceReplenishmentOrderLinesCommand {
  return {
    tenantId,
    sourceBatchId,
    orderNumber,
    lines,
  };
}

const firstLine = {
  sourceRowId: "CONT-1|CR-001|SKU-1|HBL-1",
  productNumber: "SKU-1",
  shippedQuantity: "12",
  quantityUnit: "piece" as const,
  contractNumber: null,
};

const secondLine = {
  sourceRowId: "CONT-1|CR-001|SKU-2|HBL-1",
  productNumber: "SKU-2",
  shippedQuantity: "8",
  quantityUnit: "piece" as const,
  contractNumber: null,
};

describe("PrismaReplaceReplenishmentOrderLinesRepository", () => {
  it("projects an exact replay once and exposes it through the existing cargo-ready workbench query", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      const input = command("run-1", [firstLine, secondLine]);

      await repository.execute(input);
      await repository.execute(input);

      expect(
        await prisma.replenishmentOrderLine.count({
          where: {
            tenantId: input.tenantId,
            sourceBatchId: input.sourceBatchId,
          },
        }),
      ).toBe(2);

      const workbench = new ListReplenishmentOrdersService(
        new PrismaReplenishmentOrderWorkbenchRepository(prisma as never),
        { execute: async () => null },
      );
      const page = await workbench.execute({ tenantId: input.tenantId });
      expect(page.items).toEqual([
        expect.objectContaining({
          orderNumber: "CR-001",
          workReason: expect.objectContaining({
            code: "confirm_sku_identity",
          }),
          lines: [
            expect.objectContaining({
              productNumber: "SKU-1",
              shippedQuantity: "12",
              gaps: [
                { code: "sku_identity_missing", label: "尚未匹配 SKU 物料" },
              ],
            }),
            expect.objectContaining({
              productNumber: "SKU-2",
              shippedQuantity: "8",
              gaps: [
                { code: "sku_identity_missing", label: "尚未匹配 SKU 物料" },
              ],
            }),
          ],
        }),
      ]);
    });
  });

  it("rejects partial or changed rows for the same projection batch", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(command("run-1", [firstLine]));

      await expect(
        repository.execute(command("run-1", [firstLine, firstLine])),
      ).rejects.toThrow("IMPORT_BATCH_REPLAY_CONFLICT");
      await expect(
        repository.execute(command("run-1", [firstLine, secondLine])),
      ).rejects.toThrow("IMPORT_BATCH_REPLAY_CONFLICT");
      await expect(
        repository.execute(
          command("run-1", [{ ...firstLine, shippedQuantity: "13" }]),
        ),
      ).rejects.toThrow("IMPORT_BATCH_REPLAY_CONFLICT");
    });
  });

  it("supersedes the previous batch atomically and rolls back invalid replacements", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(command("run-1", [firstLine]));
      await repository.execute(command("run-2", [secondLine]));

      expect(
        await prisma.replenishmentOrderLine.findMany({
          where: { tenantId: "demo-real-sample-20260921" },
          orderBy: { sourceBatchId: "asc" },
          select: {
            sourceBatchId: true,
            isCurrent: true,
            supersededByBatchId: true,
          },
        }),
      ).toEqual([
        {
          sourceBatchId: "run-1",
          isCurrent: false,
          supersededByBatchId: "run-2",
        },
        {
          sourceBatchId: "run-2",
          isCurrent: true,
          supersededByBatchId: null,
        },
      ]);

      await expect(
        repository.execute(
          command("run-invalid", [
            { ...firstLine, shippedQuantity: "not-a-decimal" },
          ]),
        ),
      ).rejects.toThrow();
      expect(
        await prisma.replenishmentOrderLine.findMany({
          where: { isCurrent: true },
          select: { sourceBatchId: true },
        }),
      ).toEqual([{ sourceBatchId: "run-2" }]);
    });
  });

  it("backfills a marker for exact pre-marker rows and rejects drift", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      const order = await prisma.replenishmentOrder.create({
        data: {
          tenantId: "demo-real-sample-20260921",
          orderNumber: "CR-001",
        },
      });
      await prisma.replenishmentOrderLine.createMany({
        data: [
          {
            tenantId: "demo-real-sample-20260921",
            replenishmentOrderId: order.id,
            sourceBatchId: "legacy-run",
            ...firstLine,
            shippedQuantity: "12.00",
          },
          {
            tenantId: "demo-real-sample-20260921",
            replenishmentOrderId: order.id,
            sourceBatchId: "legacy-run",
            ...secondLine,
            shippedQuantity: "8.500",
          },
        ],
      });

      await repository.execute(
        command("legacy-run", [
          { ...firstLine, shippedQuantity: "12.000" },
          { ...secondLine, shippedQuantity: "8.5000" },
        ]),
      );
      expect(
        await prisma.replenishmentOrderProjectionBatch.findUnique({
          where: {
            tenantId_replenishmentOrderId_sourceBatchId: {
              tenantId: "demo-real-sample-20260921",
              replenishmentOrderId: order.id,
              sourceBatchId: "legacy-run",
            },
          },
          select: { lineCount: true },
        }),
      ).toEqual({ lineCount: 2 });
      expect(
        await prisma.replenishmentOrderLine.count({
          where: { replenishmentOrderId: order.id },
        }),
      ).toBe(2);

      await expect(
        repository.execute(
          command("legacy-run", [{ ...firstLine, shippedQuantity: "13" }]),
        ),
      ).rejects.toThrow("IMPORT_BATCH_REPLAY_CONFLICT");
    });
  });

  it("rolls back every order when one batch command has a version conflict", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(
        command("old-a", [firstLine], undefined, "ORDER-A"),
      );
      await repository.execute(
        command("old-b", [secondLine], undefined, "ORDER-B"),
      );

      await expect(
        repository.executeBatch([
          {
            ...command("repair", [], undefined, "ORDER-A"),
            expectedCurrentSourceBatchId: "old-a",
          },
          {
            ...command("repair", [secondLine], undefined, "ORDER-B"),
            expectedCurrentSourceBatchId: "wrong-batch",
          },
        ]),
      ).rejects.toThrow("IMPORT_BATCH_REPLAY_CONFLICT");

      expect(
        await prisma.replenishmentOrderLine.findMany({
          where: { isCurrent: true },
          orderBy: { sourceBatchId: "asc" },
          select: { sourceBatchId: true },
        }),
      ).toEqual([{ sourceBatchId: "old-a" }, { sourceBatchId: "old-b" }]);
    });
  });

  it("allows the same batch and row identities in different tenants", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(command("shared-run", [firstLine], "tenant-a"));
      await repository.execute(command("shared-run", [firstLine], "tenant-b"));

      expect(
        await prisma.replenishmentOrderLine.findMany({
          where: { sourceBatchId: "shared-run" },
          orderBy: { tenantId: "asc" },
          select: { tenantId: true, sourceRowId: true },
        }),
      ).toEqual([
        { tenantId: "tenant-a", sourceRowId: firstLine.sourceRowId },
        { tenantId: "tenant-b", sourceRowId: firstLine.sourceRowId },
      ]);
    });
  });

  it("rejects a markerless empty batch when current rows already exist", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(command("run-current", [firstLine]));

      await expect(
        repository.execute(command("legacy-empty-without-marker", [])),
      ).rejects.toThrow("IMPORT_BATCH_REPLAY_CONFLICT");
      expect(
        await prisma.replenishmentOrderLine.findMany({
          where: { isCurrent: true },
          select: { sourceBatchId: true, sourceRowId: true },
        }),
      ).toEqual([
        { sourceBatchId: "run-current", sourceRowId: firstLine.sourceRowId },
      ]);
    });
  });

  it("does not let an old empty projection erase a newer non-empty batch", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(command("run-empty", []));
      await repository.execute(command("run-current", [firstLine]));
      await repository.execute(command("run-empty", []));

      expect(
        await prisma.replenishmentOrderLine.findMany({
          where: {
            tenantId: "demo-real-sample-20260921",
            isCurrent: true,
          },
          select: { sourceBatchId: true, sourceRowId: true },
        }),
      ).toEqual([
        { sourceBatchId: "run-current", sourceRowId: firstLine.sourceRowId },
      ]);
    });
  });

  it("keeps empty releases visible without manufacturing SKU lines", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const repository = new PrismaReplaceReplenishmentOrderLinesRepository(
        prisma as never,
      );
      await repository.execute(command("run-empty", []));
      await repository.execute(command("run-empty", []));

      const workbench = new ListReplenishmentOrdersService(
        new PrismaReplenishmentOrderWorkbenchRepository(prisma as never),
        { execute: async () => null },
      );
      const page = await workbench.execute({
        tenantId: "demo-real-sample-20260921",
      });
      expect(page.items[0]).toMatchObject({
        orderNumber: "CR-001",
        workReason: { code: "complete_order_lines" },
        lines: [],
      });
    });
  });
});
