import { describe, expect, it } from "vitest";
import { ListReplenishmentOrdersService } from "../../modules/shipment-registry/application/list-replenishment-orders.service";
import { ReplaceReplenishmentOrderLinesService } from "../../modules/shipment-registry/application/replace-replenishment-order-lines.service";
import { PrismaReplaceReplenishmentOrderLinesRepository } from "../../modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository";
import { PrismaReplenishmentOrderWorkbenchRepository } from "../../modules/shipment-registry/infrastructure/prisma-replenishment-order-workbench.repository";
import { withTemporaryDatabase } from "../../tools/full-chain-demo/integration-support";
import { buildFullChainLandingGraph } from "../../modules/full-chain-sample-landing/domain/landing-graph";
import { createValidFullChainPackage } from "../../modules/full-chain-sample-landing/test-support/full-chain-package.fixture";
import { FullChainCargoReadyProjector } from "../../modules/full-chain-sample-landing/infrastructure/full-chain-cargo-ready.projector";

describe("full-chain cargo-ready existing-workbench projection", () => {
  it("makes canonical cargo-ready records visible through the existing workbench service", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const graph = buildFullChainLandingGraph(createValidFullChainPackage());
      graph.stuffingLines[0]!.quantity = "10";
      const projector = new FullChainCargoReadyProjector(
        new ReplaceReplenishmentOrderLinesService(
          new PrismaReplaceReplenishmentOrderLinesRepository(prisma as never),
        ),
      );

      await projector.project({
        tenantId: "demo-real-sample-20260921",
        runId: "11111111-1111-4111-8111-111111111111",
        graph,
      });

      const workbench = new ListReplenishmentOrdersService(
        new PrismaReplenishmentOrderWorkbenchRepository(prisma as never),
        { execute: async () => null },
      );
      const page = await workbench.execute({
        tenantId: "demo-real-sample-20260921",
      });

      expect(page.items).toEqual([
        expect.objectContaining({
          orderNumber: "CR-1",
          workReason: expect.objectContaining({
            code: "confirm_sku_identity",
            label: "确认新 SKU",
          }),
          lines: [
            expect.objectContaining({
              productNumber: "SKU-1",
              shippedQuantity: "10",
              quantityUnit: "piece",
              gaps: [
                {
                  code: "sku_identity_missing",
                  label: "尚未匹配 SKU 物料",
                },
              ],
            }),
          ],
        }),
      ]);
    });
  });
});
