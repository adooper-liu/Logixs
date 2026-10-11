import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { serializeOperationalError } from "./operational-errors";
import {
  prepareNewExternalOutput,
  revalidateExternalStaging,
} from "./output-boundary";
import { collectPostgresInventory } from "./postgres-inventory";
import { collectPostgresFingerprints } from "./postgres-fingerprint";
import { collectMinioInventory } from "./minio-inventory";
import { collectTemporalInventory } from "./temporal-inventory";
import {
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "./external-adapters";

const root = path.resolve(__dirname, "../../../../..");
const LOCAL_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

type RuntimeClients = {
  prisma: {
    $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown[]>;
    $disconnect: () => Promise<void>;
  };
  minio: ReturnType<typeof createMinioInventoryAdapter>;
  temporal: ReturnType<typeof createTemporalInventoryAdapter>;
};

type ManifestCliDependencies = {
  createClients?: () => RuntimeClients;
  writeOutput?: (value: string) => void;
};

export function localModuleUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

function arg(argv: string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function createDefaultClients(): RuntimeClients {
  const databaseUrl = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
  return {
    prisma: new PrismaClient({
      adapter: createPostgresAdapter(databaseUrl, "public"),
    }),
    minio: createMinioInventoryAdapter(),
    temporal: createTemporalInventoryAdapter(),
  };
}

export async function run(
  argv = process.argv.slice(2),
  dependencies: ManifestCliDependencies = {},
) {
  if (argv.includes("--execute"))
    throw new Error("DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2");
  const tenant = arg(argv, "--tenant");
  const output = arg(argv, "--output");
  if (tenant !== "demo-real-sample-20260921")
    throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  if (!output) throw new Error("MANIFEST_OUTPUT_REQUIRED");
  const outputBoundary = await prepareNewExternalOutput({
    outputPath: output,
    repositoryRoot: root,
    approvedRoot:
      process.env.DEMO_MAINTENANCE_OUTPUT_ROOT ??
      path.join(os.tmpdir(), "logix-demo-maintenance"),
  });

  const catalog = JSON.parse(
    await readFile(
      path.join(root, "scripts/full-chain-demo/ownership-catalog.json"),
      "utf8",
    ),
  );
  const clients = (dependencies.createClients ?? createDefaultClients)();
  try {
    const { composePurgeManifest } = await import(
      localModuleUrl(path.join(root, "scripts/full-chain-demo/manifest.mjs"))
    );
    const { writeManifestAtomically } = await import(
      localModuleUrl(
        path.join(root, "scripts/full-chain-demo/manifest-writer.mjs"),
      )
    );
    const query = async (sql: string, params?: unknown[]) => ({
      rows: (await clients.prisma.$queryRawUnsafe(
        sql,
        ...(params ?? []),
      )) as Array<Record<string, unknown>>,
    });
    const postgres = await collectPostgresInventory({
      client: { query },
      catalog,
      tenantId: tenant,
    });
    const fingerprints = await collectPostgresFingerprints({ query });
    const batches = (await clients.prisma.$queryRawUnsafe(
      `SELECT "tenant_id" AS "tenantId", "source_object_key" AS "sourceObjectKey", "file_hash" AS "fileSha256", "source_size_bytes" AS "fileSize" FROM "import_batch" WHERE "source_object_key" IS NOT NULL`,
    )) as Array<{
      tenantId: string;
      sourceObjectKey?: string;
      fileSha256?: string;
      fileSize?: number;
    }>;
    const minio = await collectMinioInventory({
      client: clients.minio,
      batches,
      targetTenant: tenant,
    });
    const temporal = await collectTemporalInventory({
      client: clients.temporal,
      targetTenant: tenant,
    });
    const manifest = composePurgeManifest({
      catalog,
      postgres,
      minio,
      temporal,
      context: { operator: "cli", ...fingerprints },
    });
    const receipt = await writeManifestAtomically({
      manifest,
      outputDir: output,
      validateStaging: (staging: string) =>
        revalidateExternalStaging(outputBoundary, staging),
    });
    (dependencies.writeOutput ?? ((value) => console.log(value)))(
      JSON.stringify(receipt),
    );
    return receipt;
  } finally {
    clients.temporal.close();
    await clients.prisma.$disconnect();
  }
}

if (require.main === module)
  run().catch((error) => {
    console.error(
      serializeOperationalError(error, "MANIFEST_INVALID", randomUUID()),
    );
    process.exitCode = 1;
  });
