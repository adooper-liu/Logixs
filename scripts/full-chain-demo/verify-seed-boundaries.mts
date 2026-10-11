import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const TARGET_TENANT = "demo-real-sample-20260921";
const PRESERVED_GLOBAL_TABLES = new Set([
  "reference_data_release",
  "currency_code_reference",
  "country_code_reference",
  "cargo_owner_reference",
  "unlocode_area_reference",
  "port_code_reference",
  "port_code_entry",
  "port_name_alias",
  "source_authority_policy",
]);

export interface SeedBoundaryReceipt {
  referenceReplayStable: true;
  standardSeedTenantDelta: 0;
  legacyDemoReplayStable: true;
  otherTenantDelta: 0;
}

type Snapshot = {
  globals: Record<string, number>;
  tenants: Record<string, Record<string, number>>;
};
function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(value))
    throw new Error("SEED_BOUNDARY_IDENTIFIER_INVALID");
  return `"${value}"`;
}
function connectionFor(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}
function modelTable(model: { dbName: string | null; name: string }): string {
  return quoteIdentifier(model.dbName ?? model.name);
}
async function snapshot(prisma: PrismaClient): Promise<Snapshot> {
  const globals: Record<string, number> = {};
  const tenants: Record<string, Record<string, number>> = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const table = modelTable(model);
    if (model.fields.some((field) => field.name === "tenantId")) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "tenant_id" AS tenant, count(*)::int AS count FROM ${table} GROUP BY "tenant_id"`,
      )) as Array<{ tenant: string; count: number }>;
      tenants[model.name] = Object.fromEntries(
        rows.map((row) => [row.tenant, row.count]),
      );
    } else if (PRESERVED_GLOBAL_TABLES.has(model.dbName ?? model.name)) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS count FROM ${table}`,
      )) as Array<{ count: number }>;
      globals[model.name] = rows[0]?.count ?? 0;
    }
  }
  return { globals, tenants };
}
function equalSnapshot(left: Snapshot, right: Snapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function runSeed(
  script: "db:seed" | "db:seed:legacy-demo",
  databaseUrl: string,
): Promise<void> {
  const packageManager = process.env.npm_execpath;
  const command = packageManager
    ? [packageManager, script]
    : [
        require.resolve("tsx/cli"),
        script === "db:seed"
          ? "database/seed.ts"
          : "database/seed-legacy-demo.ts",
      ];
  await execFileAsync(process.execPath, command, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
}

export async function verifySeedBoundaries(
  databaseUrl: string,
): Promise<SeedBoundaryReceipt> {
  if (!databaseUrl.startsWith("postgresql://"))
    throw new Error("SEED_BOUNDARY_DATABASE_INVALID");
  const temporaryDatabase = `logix_verify_seed_${process.pid}_${randomBytes(8).toString("hex")}`;
  const adminUrl = connectionFor(databaseUrl, "postgres");
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl }),
  });
  let target: PrismaClient | undefined;
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE ${quoteIdentifier(temporaryDatabase)}`,
    );
    const temporaryUrl = connectionFor(databaseUrl, temporaryDatabase);
    const packageManager = process.env.npm_execpath;
    const command = packageManager
      ? [packageManager, "db:migrate"]
      : [path.resolve(process.cwd(), "scripts/migrate-deploy.mjs")];
    await execFileAsync(process.execPath, command, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: temporaryUrl },
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    target = new PrismaClient({
      adapter: new PrismaPg({ connectionString: temporaryUrl }),
    });
    const initial = await snapshot(target);
    await runSeed("db:seed", temporaryUrl);
    const afterReferenceFirst = await snapshot(target);
    await runSeed("db:seed", temporaryUrl);
    const afterReferenceSecond = await snapshot(target);
    const referenceTenantCount = Object.values(
      afterReferenceFirst.tenants,
    ).reduce(
      (sum, counts) =>
        sum + Object.values(counts).reduce((inner, count) => inner + count, 0),
      0,
    );
    const globalChanged =
      JSON.stringify(initial.globals) !==
      JSON.stringify(afterReferenceFirst.globals);
    if (
      !globalChanged ||
      referenceTenantCount !== 0 ||
      !equalSnapshot(afterReferenceFirst, afterReferenceSecond)
    )
      throw new Error("SEED_BOUNDARY_REFERENCE_NOT_STABLE");
    await runSeed("db:seed:legacy-demo", temporaryUrl);
    const afterLegacyFirst = await snapshot(target);
    await runSeed("db:seed:legacy-demo", temporaryUrl);
    const afterLegacySecond = await snapshot(target);
    if (!equalSnapshot(afterLegacyFirst, afterLegacySecond))
      throw new Error("SEED_BOUNDARY_LEGACY_NOT_IDEMPOTENT");
    const standardTenantDelta = Object.values(
      afterReferenceSecond.tenants,
    ).some((counts) =>
      Object.entries(counts).some(
        ([tenant, count]) => tenant !== TARGET_TENANT && count !== 0,
      ),
    )
      ? 1
      : 0;
    const otherTenantDelta = Object.values(afterLegacySecond.tenants).some(
      (counts) =>
        Object.entries(counts).some(
          ([tenant, count]) =>
            tenant !== TARGET_TENANT &&
            count !== (afterReferenceSecond.tenants[tenant] ?? 0),
        ),
    )
      ? 1
      : 0;
    if (standardTenantDelta !== 0 || otherTenantDelta !== 0)
      throw new Error("SEED_BOUNDARY_TENANT_SCOPE_INVALID");
    return {
      referenceReplayStable: true,
      standardSeedTenantDelta: 0,
      legacyDemoReplayStable: true,
      otherTenantDelta: 0,
    };
  } finally {
    await target?.$disconnect();
    await admin
      .$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        temporaryDatabase,
      )
      .catch(() => undefined);
    await admin
      .$executeRawUnsafe(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(temporaryDatabase)}`,
      )
      .catch(() => undefined);
    await admin.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  verifySeedBoundaries(process.env.DATABASE_URL ?? "")
    .then((receipt) => console.log(JSON.stringify(receipt)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
