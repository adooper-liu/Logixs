import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { ReplaceReplenishmentOrderLinesService } from "../../modules/shipment-registry";
import { PrismaReplaceReplenishmentOrderLinesRepository } from "../../modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository";
import { serializeOperationalError } from "./operational-errors";

const TARGET_TENANT = "demo-real-sample-20260921";
const FIXTURE_HASH =
  "166c24a7f69a059eadae723a7b850340a241bfba9747da79e584d3e608fd16da";
const BOM_HASH =
  "fcbeedd8ed65a9de854e05381bd9fa3dc4dcfb5dcaee133092d268a6b8981425";
const REPAIR_BATCH = "full-chain-cargo-ready-unit-repair-v1";
const BAD_SOURCE_BATCH = "ad20509d-955f-4b97-9ecb-a34b52f24ed0";
const UNKNOWN_UNIT_LINES = [
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
const UNKNOWN_UNIT_PRODUCTS = UNKNOWN_UNIT_LINES.map(
  ([productNumber]) => productNumber,
);
const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../../../database/seeds/fixtures/replenishment-26dsc01811-01812.json",
);

type RepairArguments = {
  tenant: typeof TARGET_TENANT;
  expectedFixtureHash: string;
};
type CurrentLine = {
  sourceRowId: string;
  productNumber: string;
  sourceBatchId: string;
  shippedQuantity: string;
  quantityUnit: string;
  contractNumber: string | null;
};
type RuntimeClient = {
  currentLines(orderNumber: string): Promise<CurrentLine[]>;
  disconnect(): Promise<void>;
};
type RepairDependencies = {
  createClient?: () => RuntimeClient;
  replaceLines?: (client: RuntimeClient) => {
    executeBatch(
      commands: Array<{
        tenantId: string;
        sourceBatchId: string;
        expectedCurrentSourceBatchId?: string;
        orderNumber: string;
        lines: Array<{
          sourceRowId: string;
          productNumber: string;
          shippedQuantity: string;
          quantityUnit: "piece" | "set";
          contractNumber: string | null;
        }>;
      }>,
    ): Promise<void>;
  };
  readFixture?: () => Promise<unknown>;
  fixtureHash?: string;
  output?: (value: string) => void;
};

function arg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseRepairArguments(argv: string[]): RepairArguments {
  if (!argv.includes("--execute"))
    throw new Error("DEMO_CARGO_READY_REPAIR_EXECUTE_REQUIRED");
  const tenant = arg(argv, "--tenant");
  if (tenant !== TARGET_TENANT)
    throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  if (arg(argv, "--confirm-repair") !== TARGET_TENANT)
    throw new Error("DEMO_CARGO_READY_REPAIR_CONFIRMATION_REQUIRED");
  const expectedFixtureHash = arg(argv, "--expected-fixture-hash");
  if (expectedFixtureHash !== FIXTURE_HASH)
    throw new Error("DEMO_CARGO_READY_REPAIR_FIXTURE_MISMATCH");
  return { tenant, expectedFixtureHash };
}

function createDefaultClient(): RuntimeClient {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://logix:logix@localhost:5433/logix?schema=public";
  const prisma = new PrismaClient({
    adapter: createPostgresAdapter(databaseUrl, "public"),
  });
  return {
    currentLines: async (orderNumber) =>
      prisma.replenishmentOrderLine
        .findMany({
          where: {
            tenantId: TARGET_TENANT,
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
    disconnect: () => prisma.$disconnect(),
    prisma,
  } as RuntimeClient;
}

async function readDefaultFixture(): Promise<unknown> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
}

export async function run(
  argv = process.argv.slice(2),
  dependencies: RepairDependencies = {},
) {
  const input = parseRepairArguments(argv);
  const fixture = validateFixture(
    await (dependencies.readFixture ?? readDefaultFixture)(),
  );
  const fixtureHash =
    dependencies.fixtureHash ??
    createHash("sha256")
      .update(await readFile(FIXTURE_PATH))
      .digest("hex");
  if (fixtureHash !== input.expectedFixtureHash)
    throw new Error("DEMO_CARGO_READY_REPAIR_FIXTURE_MISMATCH");

  const client = (dependencies.createClient ?? createDefaultClient)();
  try {
    const [trustedCurrent, unknownCurrent] = await Promise.all([
      client.currentLines("26DSC01812"),
      client.currentLines("26DSA01883"),
    ]);
    classifyCurrentState(trustedCurrent, unknownCurrent, fixture.lines);
    const sourceRowByProduct = exactCurrentSourceRows(
      trustedCurrent,
      fixture.lines.map(({ productNumber }) => productNumber),
    );
    const replace = dependencies.replaceLines
      ? dependencies.replaceLines(client)
      : new ReplaceReplenishmentOrderLinesService(
          new PrismaReplaceReplenishmentOrderLinesRepository(
            (client as RuntimeClient & { prisma: PrismaClient })
              .prisma as never,
          ),
        );
    await replace.executeBatch([
      {
        tenantId: input.tenant,
        sourceBatchId: REPAIR_BATCH,
        expectedCurrentSourceBatchId: BAD_SOURCE_BATCH,
        orderNumber: "26DSA01883",
        lines: [],
      },
      {
        tenantId: input.tenant,
        sourceBatchId: REPAIR_BATCH,
        expectedCurrentSourceBatchId: BAD_SOURCE_BATCH,
        orderNumber: "26DSC01812",
        lines: fixture.lines.map((line) => ({
          sourceRowId: sourceRowByProduct.get(line.productNumber)!,
          productNumber: line.productNumber,
          shippedQuantity: line.shippedQuantity,
          quantityUnit: line.quantityUnit,
          contractNumber: line.contractNumber,
        })),
      },
    ]);
    const result = {
      result: "repaired" as const,
      targetTenant: TARGET_TENANT,
      repairedOrders: 2,
      currentLineCount: fixture.lines.length,
      pieceLineCount: fixture.lines.filter(
        ({ quantityUnit }) => quantityUnit === "piece",
      ).length,
      setLineCount: fixture.lines.filter(
        ({ quantityUnit }) => quantityUnit === "set",
      ).length,
      withdrawnUnknownUnitLineCount: 9,
    };
    (dependencies.output ?? ((value) => process.stdout.write(`${value}\n`)))(
      JSON.stringify(result),
    );
    return result;
  } finally {
    await client.disconnect();
  }
}

function validateFixture(value: unknown): {
  lines: Array<{
    productNumber: string;
    expectedSourceRowId: string;
    shippedQuantity: string;
    quantityUnit: "piece" | "set";
    contractNumber: string | null;
  }>;
} {
  const fixture = value as {
    fixtureVersion?: unknown;
    tenantId?: unknown;
    sources?: { bom?: { sha256?: unknown } };
    productLines?: unknown;
  };
  if (
    fixture.fixtureVersion !== 1 ||
    fixture.tenantId !== TARGET_TENANT ||
    fixture.sources?.bom?.sha256 !== BOM_HASH ||
    !Array.isArray(fixture.productLines)
  ) {
    throw new Error("DEMO_CARGO_READY_REPAIR_FIXTURE_INVALID");
  }
  const lines = fixture.productLines.map((candidate) => {
    const line = candidate as Record<string, unknown>;
    if (
      line.orderNumber !== "26DSC01812" ||
      typeof line.productNumber !== "string" ||
      (line.houseBillSuffix !== "C" && line.houseBillSuffix !== "D") ||
      typeof line.shippedQuantity !== "number" ||
      (line.quantityUnit !== "piece" && line.quantityUnit !== "set") ||
      (line.contractNumber !== null && typeof line.contractNumber !== "string")
    ) {
      throw new Error("DEMO_CARGO_READY_REPAIR_FIXTURE_INVALID");
    }
    const quantityUnit = line.quantityUnit as "piece" | "set";
    return {
      productNumber: line.productNumber,
      expectedSourceRowId: `HMMU4956442|26DSC01812|${line.productNumber}|NBOZ9FF56400${line.houseBillSuffix}`,
      shippedQuantity: String(line.shippedQuantity),
      quantityUnit,
      contractNumber: line.contractNumber,
    };
  });
  if (
    lines.length !== 15 ||
    new Set(lines.map(({ productNumber }) => productNumber)).size !== 15 ||
    lines.reduce(
      (sum, { shippedQuantity }) => sum + Number(shippedQuantity),
      0,
    ) !== 504 ||
    lines.filter(({ quantityUnit }) => quantityUnit === "piece").length !==
      12 ||
    lines.filter(({ quantityUnit }) => quantityUnit === "set").length !== 3
  ) {
    throw new Error("DEMO_CARGO_READY_REPAIR_FIXTURE_INVALID");
  }
  return { lines };
}

function classifyCurrentState(
  trustedCurrent: CurrentLine[],
  unknownCurrent: CurrentLine[],
  trustedExpected: Array<{
    productNumber: string;
    expectedSourceRowId: string;
    shippedQuantity: string;
    quantityUnit: "piece" | "set";
    contractNumber: string | null;
  }>,
): "bad" | "repaired" {
  const badTrusted = trustedExpected.map((line) => ({
    sourceRowId: line.expectedSourceRowId,
    productNumber: line.productNumber,
    sourceBatchId: BAD_SOURCE_BATCH,
    shippedQuantity: line.shippedQuantity,
    quantityUnit: "piece",
    contractNumber: null,
  }));
  const badUnknown = UNKNOWN_UNIT_LINES.map(([productNumber, quantity]) => ({
    sourceRowId: `BMOU4788119|26DSA01883|${productNumber}|HDMUNBOZFS613500`,
    productNumber,
    sourceBatchId: BAD_SOURCE_BATCH,
    shippedQuantity: quantity,
    quantityUnit: "piece",
    contractNumber: null,
  }));
  if (
    sameCurrentLines(trustedCurrent, badTrusted) &&
    sameCurrentLines(unknownCurrent, badUnknown)
  )
    return "bad";

  const repairedTrusted = trustedExpected.map((line) => ({
    sourceRowId: line.expectedSourceRowId,
    productNumber: line.productNumber,
    sourceBatchId: REPAIR_BATCH,
    shippedQuantity: line.shippedQuantity,
    quantityUnit: line.quantityUnit,
    contractNumber: line.contractNumber,
  }));
  if (
    sameCurrentLines(trustedCurrent, repairedTrusted) &&
    unknownCurrent.length === 0
  )
    return "repaired";
  throw new Error("DEMO_CARGO_READY_REPAIR_CURRENT_LINES_INVALID");
}

function sameCurrentLines(
  actual: CurrentLine[],
  expected: CurrentLine[],
): boolean {
  const canonical = (lines: CurrentLine[]) =>
    [...lines]
      .map((line) => ({
        ...line,
        shippedQuantity: canonicalDecimal(line.shippedQuantity),
      }))
      .sort((left, right) =>
        Buffer.from(left.sourceRowId).compare(Buffer.from(right.sourceRowId)),
      );
  return (
    JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected))
  );
}

function canonicalDecimal(value: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value))
    throw new Error("DEMO_CARGO_READY_REPAIR_CURRENT_LINES_INVALID");
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/u, "");
  return trimmed ? `${whole}.${trimmed}` : whole!;
}

function exactCurrentSourceRows(
  current: CurrentLine[],
  expectedProductNumbers: string[],
): Map<string, string> {
  const byProduct = new Map<string, string>();
  for (const line of current) {
    if (byProduct.has(line.productNumber))
      throw new Error("DEMO_CARGO_READY_REPAIR_CURRENT_LINES_INVALID");
    byProduct.set(line.productNumber, line.sourceRowId);
  }
  if (
    current.length !== expectedProductNumbers.length ||
    expectedProductNumbers.some(
      (productNumber) => !byProduct.has(productNumber),
    )
  ) {
    throw new Error("DEMO_CARGO_READY_REPAIR_CURRENT_LINES_INVALID");
  }
  return byProduct;
}

if (require.main === module)
  run().catch((error) => {
    process.stderr.write(
      `${serializeOperationalError(
        error,
        "DEMO_CARGO_READY_REPAIR_FAILED",
        createHash("sha256")
          .update(String(Date.now()))
          .digest("hex")
          .slice(0, 32),
      )}\n`,
    );
    process.exitCode = 1;
  });
