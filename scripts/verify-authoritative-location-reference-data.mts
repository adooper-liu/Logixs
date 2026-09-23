import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { seedAuthoritativeLocationReferenceData } from "../database/seeds/seed-authoritative-location-reference-data.js";
import { seedCargoOwnerReferenceData } from "../database/seeds/seed-cargo-owner-reference-data.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260923180000_add_cargo_owner_sales_country_mapping";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingSchemaUpgrade(connectionString);
await verifyEmptyDatabaseAndSeed(connectionString);

console.log(
  "Authoritative location and cargo-owner reference data verified: old-schema upgrade, empty migration, idempotent seed, source counts, ambiguity and database constraints passed.",
);

async function verifyExistingSchemaUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-location-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      deployCurrentMigrations(targetUrl);
      const prisma = createPrisma(targetUrl);
      try {
        await assertSchema(prisma);
      } finally {
        await prisma.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
}

async function verifyEmptyDatabaseAndSeed(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const prisma = createPrisma(targetUrl);
    try {
      await assertSchema(prisma);
      const first = await seedAuthoritativeLocationReferenceData(prisma);
      const replay = await seedAuthoritativeLocationReferenceData(prisma);
      if (JSON.stringify(first) !== JSON.stringify(replay)) {
        throw new Error("Reference data seed replay returned different totals");
      }
      const firstCargoOwners = await seedCargoOwnerReferenceData(prisma);
      const replayCargoOwners = await seedCargoOwnerReferenceData(prisma);
      if (
        JSON.stringify(firstCargoOwners) !== JSON.stringify(replayCargoOwners)
      ) {
        throw new Error("Cargo owner seed replay returned different totals");
      }
      await assertSeededData(prisma);
      await assertConstraints(prisma);
    } finally {
      await prisma.$disconnect();
    }
  });
}

async function assertSchema(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      releaseTable: string | null;
      countryTable: string | null;
      areaTable: string | null;
      portTable: string | null;
      entryTable: string | null;
      aliasTable: string | null;
      cargoOwnerTable: string | null;
      activeIndex: string | null;
      areaForeignKey: string | null;
      portForeignKey: string | null;
      cargoOwnerCountryForeignKey: string | null;
      shipmentCargoOwnerForeignKey: string | null;
    }>
  >`
    SELECT
      to_regclass('public.reference_data_release')::text AS "releaseTable",
      to_regclass('public.country_code_reference')::text AS "countryTable",
      to_regclass('public.unlocode_area_reference')::text AS "areaTable",
      to_regclass('public.port_code_reference')::text AS "portTable",
      to_regclass('public.port_code_entry')::text AS "entryTable",
      to_regclass('public.port_name_alias')::text AS "aliasTable",
      to_regclass('public.cargo_owner_reference')::text AS "cargoOwnerTable",
      to_regclass('public.reference_data_release_one_active_key')::text AS "activeIndex",
      (SELECT conname FROM pg_constraint WHERE conname = 'port_code_reference_area_fkey') AS "areaForeignKey",
      (SELECT conname FROM pg_constraint WHERE conname = 'port_code_entry_port_fkey') AS "portForeignKey",
      (SELECT conname FROM pg_constraint WHERE conname = 'cargo_owner_reference_sales_country_fkey') AS "cargoOwnerCountryForeignKey",
      (SELECT conname FROM pg_constraint WHERE conname = 'shipment_cargo_owner_fkey') AS "shipmentCargoOwnerForeignKey"
  `;
  const row = rows[0];
  if (
    row?.releaseTable !== "reference_data_release" ||
    row.countryTable !== "country_code_reference" ||
    row.areaTable !== "unlocode_area_reference" ||
    row.portTable !== "port_code_reference" ||
    row.entryTable !== "port_code_entry" ||
    row.aliasTable !== "port_name_alias" ||
    row.cargoOwnerTable !== "cargo_owner_reference" ||
    row.activeIndex !== "reference_data_release_one_active_key" ||
    row.areaForeignKey !== "port_code_reference_area_fkey" ||
    row.portForeignKey !== "port_code_entry_port_fkey" ||
    row.cargoOwnerCountryForeignKey !==
      "cargo_owner_reference_sales_country_fkey" ||
    row.shipmentCargoOwnerForeignKey !== "shipment_cargo_owner_fkey"
  ) {
    throw new Error(
      `Location reference schema verification failed: ${JSON.stringify(row)}`,
    );
  }
}

async function assertSeededData(prisma: PrismaClient): Promise<void> {
  const [
    countries,
    areas,
    ports,
    entries,
    aliases,
    cargoOwners,
    activeReleases,
  ] = await Promise.all([
    prisma.countryCodeReference.count(),
    prisma.unlocodeAreaReference.count(),
    prisma.portCodeReference.count(),
    prisma.portCodeEntry.count(),
    prisma.portNameAlias.count(),
    prisma.cargoOwnerReference.count(),
    prisma.referenceDataRelease.count({ where: { status: "active" } }),
  ]);
  if (
    countries !== 249 ||
    areas !== 249 ||
    ports !== 17_524 ||
    entries !== 17_600 ||
    aliases !== 14 ||
    cargoOwners !== 9 ||
    activeReleases !== 3
  ) {
    throw new Error(
      `Unexpected reference totals: ${[countries, areas, ports, entries, aliases, cargoOwners, activeReleases].join(",")}`,
    );
  }

  const [fuzhouAliases, fuzhouCodes, yantian, internationalWaters] =
    await Promise.all([
      prisma.portNameAlias.findMany({
        where: { normalizedAlias: "福州" },
        include: { port: true },
        orderBy: { port: { unlocode: "asc" } },
      }),
      prisma.portCodeReference.findMany({
        where: { unlocode: { in: ["CNFZG", "CNFZH", "CNFZX"] } },
        orderBy: { unlocode: "asc" },
      }),
      prisma.portCodeReference.findFirst({
        where: { unlocode: "CNYTN" },
        include: { entries: true },
      }),
      prisma.unlocodeAreaReference.findFirst({
        where: { areaCode: "XZ" },
      }),
    ]);
  if (
    fuzhouAliases.length !== 3 ||
    fuzhouAliases.some((alias) => alias.mappingState !== "candidate") ||
    fuzhouCodes.length !== 3 ||
    !yantian?.entries.some((entry) => entry.name === "Yantian Pt") ||
    internationalWaters?.isoCountryId !== null
  ) {
    throw new Error("Port identity, alias ambiguity or XZ separation failed");
  }

  const ukOwner = await prisma.cargoOwnerReference.findFirst({
    where: { internalCountryShortCode: "UK" },
    include: { salesCountry: true, release: true },
  });
  if (
    ukOwner?.legalName !== "MH STAR UK LTD" ||
    ukOwner.salesCountry.alpha2 !== "GB" ||
    ukOwner.release.status !== "active"
  ) {
    throw new Error(
      "Cargo owner UK abbreviation was not separated from ISO GB",
    );
  }
}

async function assertConstraints(prisma: PrismaClient): Promise<void> {
  const isoRelease = await prisma.referenceDataRelease.findFirstOrThrow({
    where: { datasetCode: "ISO_3166_1", status: "active" },
  });
  let invalidCountryRejected = false;
  try {
    await prisma.countryCodeReference.create({
      data: {
        releaseId: isoRelease.id,
        alpha2: "C1",
        alpha3: "BAD",
        numericCode: "999",
        nameEnglish: "Invalid",
        nameFrench: "Invalid",
        sourceRowHash: "a".repeat(64),
      },
    });
  } catch {
    invalidCountryRejected = true;
  }
  if (!invalidCountryRejected)
    throw new Error("Invalid ISO alpha-2 was accepted");

  const yantian = await prisma.portCodeReference.findFirstOrThrow({
    where: { unlocode: "CNYTN" },
  });
  let unreviewedConfirmationRejected = false;
  try {
    await prisma.portNameAlias.create({
      data: {
        id: randomUUID(),
        portId: yantian.id,
        aliasName: "未复核盐田",
        normalizedAlias: "未复核盐田",
        languageTag: "zh-Hans",
        sourceSystem: "verification",
        sourceVersion: "1",
        sourceRecordId: "unreviewed-confirmation",
        mappingState: "confirmed",
        evidenceRef: "verification",
        evidenceHash: "b".repeat(64),
        createdBy: "verification",
      },
    });
  } catch {
    unreviewedConfirmationRejected = true;
  }
  if (!unreviewedConfirmationRejected) {
    throw new Error("Unreviewed confirmed alias was accepted");
  }

  let secondActiveReleaseRejected = false;
  try {
    await prisma.referenceDataRelease.create({
      data: {
        id: randomUUID(),
        authority: "ISO",
        datasetCode: "ISO_3166_1",
        version: "verification-conflict",
        sourceUrl: "https://example.invalid",
        retrievedAt: new Date(),
        sourceSha256: "c".repeat(64),
        recordsSha256: "d".repeat(64),
        license: "verification",
        status: "active",
      },
    });
  } catch {
    secondActiveReleaseRejected = true;
  }
  if (!secondActiveReleaseRejected) {
    throw new Error("Second active reference release was accepted");
  }

  const cargoOwnerRelease = await prisma.referenceDataRelease.findFirstOrThrow({
    where: { datasetCode: "CARGO_OWNER_SALES_COUNTRY", status: "active" },
  });
  const us = await prisma.countryCodeReference.findFirstOrThrow({
    where: { alpha2: "US", release: { status: "active" } },
  });
  let invalidOwnerRejected = false;
  try {
    await prisma.cargoOwnerReference.create({
      data: {
        id: randomUUID(),
        releaseId: cargoOwnerRelease.id,
        stableCode: "INVALID_OWNER",
        legalName: "Invalid Owner",
        normalizedName: "INVALID OWNER",
        internalCountryShortCode: "USA",
        salesCountryId: us.id,
        sourceSystem: "verification",
        sourceVersion: "1",
        sourceRecordId: "invalid-owner",
        sourceRowHash: "e".repeat(64),
      },
    });
  } catch {
    invalidOwnerRejected = true;
  }
  if (!invalidOwnerRejected) {
    throw new Error("Invalid cargo owner internal abbreviation was accepted");
  }
}

async function withTemporaryDatabase(
  source: string,
  suffix: string,
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_location_${suffix}_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_location_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)) {
    throw new Error("Unsafe temporary database name");
  }
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${databaseName}`;
  targetUrl.searchParams.set("schema", "public");
  const admin = createPrisma(adminUrl.toString());
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await verify(targetUrl.toString());
  } finally {
    if (created) {
      await admin.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await admin.$disconnect();
  }
}

function prepareLegacyMigrationFixture(fixtureRoot: string): string {
  const sourceRoot = resolve("database/migrations");
  const migrationRoot = join(fixtureRoot, "migrations");
  mkdirSync(migrationRoot);
  copyFileSync(
    join(sourceRoot, "migration_lock.toml"),
    join(migrationRoot, "migration_lock.toml"),
  );
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      /^\d{14}_/.test(entry.name) &&
      entry.name < targetMigration
    ) {
      cpSync(join(sourceRoot, entry.name), join(migrationRoot, entry.name), {
        recursive: true,
      });
    }
  }
  const configPath = join(fixtureRoot, "prisma.config.mjs");
  const prismaConfigUrl = pathToFileURL(require.resolve("prisma/config")).href;
  writeFileSync(
    configPath,
    `import { defineConfig } from ${JSON.stringify(prismaConfigUrl)};\n\nexport default defineConfig({\n  schema: ${JSON.stringify(resolve("database/schema.prisma"))},\n  datasource: { url: process.env.DATABASE_URL },\n  migrations: { path: ${JSON.stringify(migrationRoot)} },\n});\n`,
  );
  return configPath;
}

function deployLegacyMigrations(configPath: string, url: string): void {
  const deploy = () =>
    runPrisma(["migrate", "deploy", "--config", configPath], url);
  const firstAttempt = deploy();
  if (firstAttempt.status === 0) return;
  const output = `${firstAttempt.stdout ?? ""}\n${firstAttempt.stderr ?? ""}`;
  if (!isKnownEmptyDatabaseFailure(output)) {
    throw new Error(`Legacy migration fixture failed:\n${output}`);
  }
  const resolved = runPrisma(
    [
      "migrate",
      "resolve",
      "--applied",
      "20260913011044_inbox",
      "--config",
      configPath,
    ],
    url,
  );
  if (resolved.status !== 0) {
    throw new Error(
      `Legacy migration recovery failed:\n${resolved.stdout ?? ""}\n${resolved.stderr ?? ""}`,
    );
  }
  const retry = deploy();
  if (retry.status !== 0) {
    throw new Error(
      `Legacy migration retry failed:\n${retry.stdout ?? ""}\n${retry.stderr ?? ""}`,
    );
  }
}

function deployCurrentMigrations(url: string): void {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error("npm_execpath is required to run migrations");
  const migration = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
  if (migration.status !== 0) {
    throw new Error(
      `Database migration failed:\n${migration.stdout ?? ""}\n${migration.stderr ?? ""}`,
    );
  }
}

function runPrisma(args: string[], url: string) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
