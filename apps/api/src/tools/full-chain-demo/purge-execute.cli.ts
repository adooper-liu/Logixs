import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { validatePurgeManifestIntegrity } from "./manifest-integrity";
import { serializeOperationalError } from "./operational-errors";
import { assertExternalArtifactFile } from "./output-boundary";
import { collectPostgresFingerprints } from "./postgres-fingerprint";
import { collectPostgresInventory } from "./postgres-inventory";
import {
  purgeDeletePlanOnTransaction,
  type PurgeManifest,
} from "./postgres-purge";

const root = path.resolve(__dirname, "../../../../..");
const TARGET_TENANT = "demo-real-sample-20260921";
const LOCAL_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

type QueryClient = {
  $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown[]>;
};
type RuntimeClient = QueryClient & {
  $transaction: <T>(
    run: (transaction: QueryClient) => Promise<T>,
    options?: { isolationLevel?: "Serializable"; timeout?: number },
  ) => Promise<T>;
  $disconnect: () => Promise<void>;
};
type ExecuteDependencies = {
  createClient?: () => RuntimeClient;
  output?: (value: string) => void;
};

type ExecutionArguments = {
  tenant: typeof TARGET_TENANT;
  manifestPath: string;
  expectedHash: string;
};

function arg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseExecutionArguments(argv: string[]): ExecutionArguments {
  if (!argv.includes("--execute"))
    throw new Error("DEMO_PURGE_EXECUTE_REQUIRED");
  const tenant = arg(argv, "--tenant");
  if (tenant !== TARGET_TENANT)
    throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  if (arg(argv, "--confirm-delete") !== TARGET_TENANT)
    throw new Error("DEMO_PURGE_CONFIRMATION_REQUIRED");
  const manifestPath = arg(argv, "--manifest");
  const expectedHash =
    arg(argv, "--expected-manifest-hash") ?? arg(argv, "--manifest-hash");
  if (!manifestPath || !expectedHash)
    throw new Error("PURGE_MANIFEST_INPUT_REQUIRED");
  return { tenant, manifestPath, expectedHash };
}

function createDefaultClient(): RuntimeClient {
  const databaseUrl = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
  return new PrismaClient({
    adapter: createPostgresAdapter(databaseUrl, "public"),
  }) as RuntimeClient;
}

export async function run(
  argv = process.argv.slice(2),
  dependencies: ExecuteDependencies = {},
) {
  const input = parseExecutionArguments(argv);
  const manifestFile = await assertExternalArtifactFile({
    artifactPath: input.manifestPath,
    repositoryRoot: root,
    approvedRoot:
      process.env.DEMO_MAINTENANCE_OUTPUT_ROOT ??
      path.join(os.tmpdir(), "logix-demo-maintenance"),
  });
  const manifest = JSON.parse(
    await readFile(manifestFile, "utf8"),
  ) as PurgeManifest & Record<string, unknown>;
  const catalog = JSON.parse(
    await readFile(
      path.join(root, "scripts/full-chain-demo/ownership-catalog.json"),
      "utf8",
    ),
  );
  await validatePurgeManifestIntegrity({
    manifest,
    expectedHash: input.expectedHash,
    expectedTenant: TARGET_TENANT,
    expectedCatalogVersion: catalog.catalogVersion,
    repositoryRoot: root,
  });

  const client = (dependencies.createClient ?? createDefaultClient)();
  try {
    const { canonicalStringify } = await import(
      pathToFileURL(
        path.join(root, "scripts/full-chain-demo/canonical-json.mjs"),
      ).href
    );
    const { composePurgeManifest } = await import(
      pathToFileURL(path.join(root, "scripts/full-chain-demo/manifest.mjs"))
        .href
    );
    const result = await client.$transaction(
      async (transaction) => {
        const query = async (sql: string, params?: unknown[]) => ({
          rows: (await transaction.$queryRawUnsafe(
            sql,
            ...(params ?? []),
          )) as Array<Record<string, unknown>>,
        });
        const postgres = await collectPostgresInventory({
          client: { query },
          catalog,
          tenantId: TARGET_TENANT,
        });
        if (postgres.blockers.length)
          throw new Error("OWNERSHIP_BLOCKERS_PRESENT");
        const fingerprints = await collectPostgresFingerprints({ query });
        const current = composePurgeManifest({
          catalog,
          postgres,
          minio: {
            entries: (manifest.minio as { entries: unknown[] }).entries,
            candidateCount: (manifest.minio as { candidateCount: number })
              .candidateCount,
            blockers: (
              manifest.blockers as { entries: Array<{ code: string }> }
            ).entries.map(({ code }) => code),
          },
          temporal: {
            entries: (manifest.temporal as { entries: unknown[] }).entries,
            candidateCount: (manifest.temporal as { candidateCount: number })
              .candidateCount,
          },
          context: {
            operator: "cli",
            generatedAt: manifest.generatedAt,
            ...fingerprints,
          },
        });
        for (const field of [
          "catalogHash",
          "schemaFingerprint",
          "migrationFingerprint",
          "postgres",
        ] as const)
          if (
            canonicalStringify(manifest[field]) !==
            canonicalStringify(current[field])
          )
            throw new Error("MANIFEST_STALE");

        return purgeDeletePlanOnTransaction({
          transaction,
          targetTenantId: TARGET_TENANT,
          manifest,
        });
      },
      { isolationLevel: "Serializable", timeout: 120_000 },
    );

    const receipt = {
      result: result.result,
      targetTenant: TARGET_TENANT,
      deletedPostgresRows: result.deleted,
      manifestHash: result.manifestHash.slice(0, 12),
      minioObjectsDeleted: 0,
      temporalItemsModified: 0,
    };
    (dependencies.output ?? ((value) => process.stdout.write(`${value}\n`)))(
      JSON.stringify(receipt),
    );
    return receipt;
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module)
  run().catch((error) => {
    process.stderr.write(
      `${serializeOperationalError(error, "DEMO_PURGE_FAILED", randomUUID())}\n`,
    );
    process.exitCode = 1;
  });
