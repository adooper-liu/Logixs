import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

export const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
export const REPOSITORY_ROOT = resolve(__dirname, "../../../../..");

export function databaseUrl(databaseName: string): string {
  const url = new URL(BASE_DATABASE_URL);
  url.pathname = `/${databaseName}`;
  url.searchParams.set("schema", "public");
  return url.toString();
}

export function createIntegrationPrismaClient(databaseName: string) {
  return new PrismaClient({
    adapter: createPostgresAdapter(databaseUrl(databaseName), "public"),
  });
}

export async function withTemporaryDatabase<T>(
  run: (input: {
    databaseName: string;
    databaseUrl: string;
    prisma: InstanceType<typeof PrismaClient>;
  }) => Promise<T>,
): Promise<T> {
  const databaseName = `logix_rehearsal_${process.pid}_${randomUUID()
    .replaceAll("-", "")
    .slice(0, 16)}`;
  const adminUrl = databaseUrl("postgres");
  const admin = new PrismaClient({
    adapter: createPostgresAdapter(adminUrl, "public"),
  });
  let prisma: InstanceType<typeof PrismaClient> | undefined;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    const targetUrl = databaseUrl(databaseName);
    const pnpmEntrypoint = process.env.npm_execpath;
    const migrationCommand = pnpmEntrypoint
      ? [pnpmEntrypoint, "db:migrate"]
      : [resolve(REPOSITORY_ROOT, "scripts/migrate-deploy.mjs")];
    execFileSync(process.execPath, migrationCommand, {
      cwd: REPOSITORY_ROOT,
      env: { ...process.env, DATABASE_URL: targetUrl },
      stdio: "pipe",
    });
    prisma = new PrismaClient({
      adapter: createPostgresAdapter(targetUrl, "public"),
    });
    await prisma.$connect();
    return await run({ databaseName, databaseUrl: targetUrl, prisma });
  } finally {
    await prisma?.$disconnect();
    try {
      await admin.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        databaseName,
      );
      await admin.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${databaseName}"`,
      );
    } finally {
      await admin.$disconnect();
    }
  }
}
