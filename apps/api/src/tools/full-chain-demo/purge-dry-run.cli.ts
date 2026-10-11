import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { pathToFileURL } from "node:url";
import { validatePurgeManifestIntegrity } from "./manifest-integrity";
import {
  rehearseDeletePlanOnTransaction,
  runRollbackOnlySerializable,
} from "./postgres-dry-run";
import { collectPostgresInventory } from "./postgres-inventory";
import { collectPostgresFingerprints } from "./postgres-fingerprint";
import { collectMinioInventory } from "./minio-inventory";
import { collectTemporalInventory } from "./temporal-inventory";
import {
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "./external-adapters";

import { serializeOperationalError } from "./operational-errors";
import { assertExternalArtifactFile } from "./output-boundary";

const root = path.resolve(__dirname, "../../../../..");
const LOCAL_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

type TransactionClient = {
  $executeRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown>;
  $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown[]>;
};
type RuntimeClients = {
  prisma: TransactionClient & {
    $transaction: (
      run: (transaction: TransactionClient) => Promise<void>,
    ) => Promise<void>;
    $disconnect: () => Promise<void>;
  };
  minio: ReturnType<typeof createMinioInventoryAdapter>;
  temporal: ReturnType<typeof createTemporalInventoryAdapter>;
};
type DryRunDependencies = {
  createClients?: () => RuntimeClients;
  writeOutput?: (value: string) => void;
};

export function manifestStaleError(
  differences: Array<{ code: string; [key: string]: unknown }>,
): Error {
  return new Error(
    `MANIFEST_STALE:${differences.map(({ code }) => code).join(",")}`,
  );
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
  } as RuntimeClients;
}

export async function run(
  argv = process.argv.slice(2),
  dependencies: DryRunDependencies = {},
) {
  if (argv.includes("--execute"))
    throw new Error("DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2");
  if (arg(argv, "--tenant") !== "demo-real-sample-20260921")
    throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  const manifestPath = arg(argv, "--manifest");
  const expectedHash =
    arg(argv, "--manifest-hash") ?? arg(argv, "--expected-manifest-hash");
  if (!manifestPath || !expectedHash)
    throw new Error("PURGE_MANIFEST_INPUT_REQUIRED");

  const manifestFile = await assertExternalArtifactFile({
    artifactPath: manifestPath,
    repositoryRoot: root,
    approvedRoot:
      process.env.DEMO_MAINTENANCE_OUTPUT_ROOT ??
      path.join(os.tmpdir(), "logix-demo-maintenance"),
  });
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const catalog = JSON.parse(
    await readFile(
      path.join(root, "scripts/full-chain-demo/ownership-catalog.json"),
      "utf8",
    ),
  );
  await validatePurgeManifestIntegrity({
    manifest,
    expectedHash,
    expectedTenant: "demo-real-sample-20260921",
    expectedCatalogVersion: catalog.catalogVersion,
    repositoryRoot: root,
  });
  const clients = (dependencies.createClients ?? createDefaultClients)();
  try {
    const { composePurgeManifest, compareManifestState } = await import(
      pathToFileURL(path.join(root, "scripts/full-chain-demo/manifest.mjs"))
        .href
    );
    const transactionResult = await runRollbackOnlySerializable({
      prisma: clients.prisma,
      work: async (transaction) => {
        const query = async (sql: string, params?: unknown[]) => ({
          rows: (await transaction.$queryRawUnsafe(
            sql,
            ...(params ?? []),
          )) as Array<Record<string, unknown>>,
        });
        const postgres = await collectPostgresInventory({
          client: { query },
          catalog,
          tenantId: manifest.targetTenant,
        });
        const fingerprints = await collectPostgresFingerprints({ query });
        const batches = (await transaction.$queryRawUnsafe(
          `SELECT "tenant_id" AS "tenantId", "source_object_key" AS "sourceObjectKey", "file_hash" AS "fileSha256", "source_size_bytes" AS "fileSize" FROM "import_batch" WHERE "source_object_key" IS NOT NULL`,
        )) as Array<{
          tenantId: string;
          sourceObjectKey?: string;
          fileSha256?: string;
          fileSize?: number;
        }>;
        const [minio, temporal] = await Promise.all([
          collectMinioInventory({
            client: clients.minio,
            batches,
            targetTenant: manifest.targetTenant,
          }),
          collectTemporalInventory({
            client: clients.temporal,
            targetTenant: manifest.targetTenant,
          }),
        ]);
        const current = composePurgeManifest({
          catalog,
          postgres,
          minio,
          temporal,
          context: { operator: "cli", ...fingerprints },
        });
        const differences = compareManifestState(manifest, current);
        if (differences.length) throw manifestStaleError(differences);
        const result = await rehearseDeletePlanOnTransaction({
          transaction,
          manifest: current,
        });
        return { result, postgres, fingerprints, batches, minio, temporal };
      },
    });
    const [minioAfter, temporalAfter] = await Promise.all([
      collectMinioInventory({
        client: clients.minio,
        batches: transactionResult.batches,
        targetTenant: manifest.targetTenant,
      }),
      collectTemporalInventory({
        client: clients.temporal,
        targetTenant: manifest.targetTenant,
      }),
    ]);
    const afterExternal = composePurgeManifest({
      catalog,
      postgres: transactionResult.postgres,
      minio: minioAfter,
      temporal: temporalAfter,
      context: { operator: "cli", ...transactionResult.fingerprints },
    });
    const externalDifferences = compareManifestState(manifest, afterExternal);
    if (externalDifferences.length)
      throw manifestStaleError(externalDifferences);

    const receipt = {
      result: transactionResult.result.result,
      postgresCandidateCount: transactionResult.result.planned,
      minioCandidateCount: manifest.minio.candidateCount,
      temporalTargetCount: manifest.temporal.candidateCount,
      blockerCount: manifest.blockers.count,
      manifestHash: manifest.manifestHash.slice(0, 12),
    };
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
      serializeOperationalError(error, "MANIFEST_STALE", randomUUID()),
    );
    process.exitCode = 1;
  });
