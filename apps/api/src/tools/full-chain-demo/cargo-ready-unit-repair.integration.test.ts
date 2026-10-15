import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ReplaceReplenishmentOrderLinesService } from "../../modules/shipment-registry";
import { PrismaReplaceReplenishmentOrderLinesRepository } from "../../modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository";
import { withTemporaryDatabase } from "./integration-support";
import { run } from "./cargo-ready-unit-repair.cli";

const FIXTURE_HASH =
  "166c24a7f69a059eadae723a7b850340a241bfba9747da79e584d3e608fd16da";
const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../../../database/seeds/fixtures/replenishment-26dsc01811-01812.json",
);
const BAD_SOURCE_BATCH = "ad20509d-955f-4b97-9ecb-a34b52f24ed0";
const UNKNOWN_LINES = [
  ["370-064V80RD", "50"],
  ["370-211V80BU", "30"],
  ["370-235V80RD", "100"],
  ["370-237V80BK", "40"],
  ["370-276V00BK", "50"],
  ["370-276V00WT", "50"],
  ["370-335V80GN", "30"],
  ["370-335V80RD", "51"],
  ["370-400V80BU", "75"],
] as const;

describe("cargo-ready unit repair", () => {
  it("version-corrects trusted lines, withdraws unknown units, and replays exactly", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as {
        productLines: Array<{
          productNumber: string;
          shippedQuantity: number;
          contractNumber: string | null;
          houseBillSuffix: string;
        }>;
      };
      const service = new ReplaceReplenishmentOrderLinesService(
        new PrismaReplaceReplenishmentOrderLinesRepository(prisma as never),
      );
      await service.execute({
        tenantId: "demo-real-sample-20260921",
        sourceBatchId: BAD_SOURCE_BATCH,
        orderNumber: "26DSC01812",
        lines: fixture.productLines.map((line) => ({
          sourceRowId: `HMMU4956442|26DSC01812|${line.productNumber}|NBOZ9FF56400${line.houseBillSuffix}`,
          productNumber: line.productNumber,
          shippedQuantity: String(line.shippedQuantity),
          quantityUnit: "piece",
          contractNumber: null,
        })),
      });
      await service.execute({
        tenantId: "demo-real-sample-20260921",
        sourceBatchId: BAD_SOURCE_BATCH,
        orderNumber: "26DSA01883",
        lines: UNKNOWN_LINES.map(([productNumber, shippedQuantity]) => ({
          sourceRowId: `BMOU4788119|26DSA01883|${productNumber}|HDMUNBOZFS613500`,
          productNumber,
          shippedQuantity,
          quantityUnit: "piece" as const,
          contractNumber: null,
        })),
      });
      const client = {
        currentLines: (orderNumber: string) =>
          prisma.replenishmentOrderLine
            .findMany({
              where: {
                tenantId: "demo-real-sample-20260921",
                isCurrent: true,
                replenishmentOrder: { orderNumber },
              },
              orderBy: [{ productNumber: "asc" }, { id: "asc" }],
              select: {
                sourceRowId: true,
                productNumber: true,
                sourceBatchId: true,
                shippedQuantity: true,
                quantityUnit: true,
                contractNumber: true,
              },
            })
            .then((lines) =>
              lines.map((line) => ({
                ...line,
                shippedQuantity: line.shippedQuantity.toString(),
              })),
            ),
        disconnect: async () => undefined,
        prisma,
      };
      const execute = () =>
        run(
          [
            "--execute",
            "--tenant",
            "demo-real-sample-20260921",
            "--expected-fixture-hash",
            FIXTURE_HASH,
            "--confirm-repair",
            "demo-real-sample-20260921",
          ],
          {
            createClient: () => client,
            replaceLines: () => service,
            fixtureHash: FIXTURE_HASH,
            readFixture: async () =>
              JSON.parse(await readFile(FIXTURE_PATH, "utf8")),
            output: () => undefined,
          },
        );

      await execute();
      await execute();

      const current = await prisma.replenishmentOrderLine.findMany({
        where: { tenantId: "demo-real-sample-20260921", isCurrent: true },
        orderBy: { productNumber: "asc" },
        select: {
          productNumber: true,
          quantityUnit: true,
          sourceBatchId: true,
        },
      });
      expect(current).toHaveLength(15);
      expect(
        current.filter(({ quantityUnit }) => quantityUnit === "piece"),
      ).toHaveLength(12);
      expect(
        current.filter(({ quantityUnit }) => quantityUnit === "set"),
      ).toHaveLength(3);
      expect(
        new Set(current.map(({ sourceBatchId }) => sourceBatchId)),
      ).toEqual(new Set(["full-chain-cargo-ready-unit-repair-v1"]));
      expect(
        await prisma.replenishmentOrderLine.count({
          where: {
            tenantId: "demo-real-sample-20260921",
            sourceBatchId: BAD_SOURCE_BATCH,
            isCurrent: false,
          },
        }),
      ).toBe(24);
      expect(
        await prisma.replenishmentOrderLine.count({
          where: {
            tenantId: "demo-real-sample-20260921",
            replenishmentOrder: { orderNumber: "26DSA01883" },
            isCurrent: true,
          },
        }),
      ).toBe(0);
    });
  });
});
