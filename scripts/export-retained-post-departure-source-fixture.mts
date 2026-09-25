import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { format } from "prettier";
import { PrismaClient } from "../generated/prisma/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = resolve(
  repositoryRoot,
  "docs/product/domain/evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json",
);
const fixturePath = resolve(
  repositoryRoot,
  "database/seeds/fixtures/post-departure-source-package-20260923.json",
);
const tenantId = process.argv[2]?.trim() || "demo-real-sample-20260921";
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

const sourceKinds = {
  "引出列表_货柜信息表_0923092212.xlsx": "container",
  "引出列表_清关信息表_0923092240.xlsx": "customs",
  "引出列表_物流信息表_0923092155.xlsx": "logistics",
  "引出列表_仓库信息表_0923092259.xlsx": "warehouse",
} as const;
const sourceOrder = ["container", "customs", "logistics", "warehouse"];

type Inventory = {
  sourceFiles: Array<{
    file: string;
    role: string;
    sha256: string;
    declaredRange: string;
    actualRange: string;
    columnCount: number;
    headerSignature: string;
  }>;
};

const inventory = JSON.parse(
  await readFile(inventoryPath, "utf8"),
) as Inventory;
const maintenanceSources = inventory.sourceFiles.filter(
  ({ role }) => role === "maintenance_source",
);
if (maintenanceSources.length !== 4) {
  throw new Error(
    `expected four maintenance sources, found ${maintenanceSources.length}`,
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }, { schema: "public" }),
});

try {
  const sources = [];
  for (const source of maintenanceSources) {
    const kind = sourceKinds[source.file as keyof typeof sourceKinds];
    if (!kind) throw new Error(`unknown maintenance source: ${source.file}`);
    const batch = await prisma.importBatch.findFirst({
      where: { tenantId, fileHash: source.sha256 },
      orderBy: { createdAt: "desc" },
      select: {
        fileName: true,
        fileHash: true,
        sourceSizeBytes: true,
        parserVersion: true,
        rowCount: true,
        columnCount: true,
        rows: {
          orderBy: { rowNo: "asc" },
          select: { rowNo: true, snapshot: true },
        },
      },
    });
    if (!batch) {
      throw new Error(`${source.file}: retained import batch not found`);
    }
    if (
      batch.fileName !== source.file ||
      batch.fileHash !== source.sha256 ||
      batch.rowCount !== 20 ||
      batch.rows.length !== 20 ||
      batch.columnCount !== source.columnCount ||
      !batch.sourceSizeBytes ||
      batch.sourceSizeBytes < 1
    ) {
      throw new Error(`${source.file}: retained batch does not match evidence`);
    }
    sources.push({
      kind,
      sourceFile: source.file,
      sourceSha256: source.sha256,
      sourceSizeBytes: batch.sourceSizeBytes,
      declaredRange: source.declaredRange,
      actualRange: source.actualRange,
      headerSignature: source.headerSignature,
      parserVersion: batch.parserVersion,
      rowCount: batch.rowCount,
      columnCount: batch.columnCount,
      rows: batch.rows.map(({ rowNo, snapshot }) => ({
        rowNo,
        values: snapshot,
      })),
    });
  }
  sources.sort(
    (left, right) =>
      sourceOrder.indexOf(left.kind) - sourceOrder.indexOf(right.kind),
  );
  const fixture = {
    schemaVersion: "1.0.0",
    purpose: "post_departure_source_package_operational_closeout",
    sourceInventoryRef:
      "docs/product/domain/evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json",
    captureBoundary:
      "retained import rows matched by tenant and authoritative workbook SHA-256; local batch IDs excluded",
    sources,
  };
  await writeFile(
    fixturePath,
    await format(JSON.stringify(fixture), { parser: "json" }),
    "utf8",
  );
  console.log(
    `Exported ${sources.length} sources and ${sources.reduce((sum, source) => sum + source.rows.length, 0)} rows to ${fixturePath}`,
  );
} finally {
  await prisma.$disconnect();
}
