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
import { normalizeReplaceProductComplianceProfileCommand } from "../apps/api/src/modules/master-data/domain/product-compliance-profile.js";
import { PrismaProductComplianceProfileRepository } from "../apps/api/src/modules/master-data/infrastructure/prisma-product-compliance-profile.repository.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260920220000_add_product_compliance_profiles";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(
      join(tmpdir(), "logix-compliance-upgrade-"),
    );
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      const legacy = createPrisma(targetUrl);
      const skuId = randomUUID();
      try {
        await legacy.productSku.create({
          data: {
            id: skuId,
            tenantId: "legacy-tenant",
            productNumber: "LEGACY-COMPLIANCE-SKU",
          },
        });
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);
      const upgraded = createPrisma(targetUrl);
      try {
        await assertSchema(upgraded);
        const sku = await upgraded.productSku.findUnique({
          where: { id: skuId },
        });
        const profiles = await upgraded.productComplianceProfile.count();
        if (!sku || profiles !== 0) {
          throw new Error("Compliance migration rewrote existing SKU data");
        }
      } finally {
        await upgraded.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Product compliance profiles verified: existing SKU data upgraded without guessed compliance facts.",
  );
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const prisma = createPrisma(targetUrl);
    try {
      await assertSchema(prisma);
      const productSkuId = randomUUID();
      await prisma.productSku.create({
        data: {
          id: productSkuId,
          tenantId: "tenant-a",
          productNumber: "SKU-COMPLIANCE-1",
        },
      });
      const repository = new PrismaProductComplianceProfileRepository(
        prisma as never,
      );
      const firstCommand = normalizeReplaceProductComplianceProfileCommand({
        tenantId: "tenant-a",
        productSkuId,
        expectedProfileVersion: 0,
        battery: {
          presenceState: "present",
          chemistryCode: "lithium_ion",
          modelNumber: "BAT-1",
          cellCount: 4,
          batteryCount: 1,
          wattHours: "98",
          removable: true,
          packingMode: "contained_in_equipment",
        },
        refrigerant: { presenceState: "absent" },
        dangerousGoods: {
          classificationState: "regulated",
          unNumber: "UN3481",
          properShippingName: "Lithium ion batteries contained in equipment",
          hazardClass: "9",
          marinePollutant: false,
        },
        inspectionRequirements: [
          {
            requirementType: "commodity_inspection",
            requirementState: "required",
            jurisdictionCountryCode: "CN",
          },
        ],
        certificates: [
          {
            certificateKey: "un38-main",
            certificateType: "un38_3",
            certificateNumber: "UN38-3-001",
            issuerName: "Qualified Laboratory",
            coverageScope: "countries",
            coveredCountryCodes: ["CN", "US"],
            validFrom: "2026-01-01",
            validUntil: "2027-01-01",
            documentRecordId: randomUUID(),
            verificationState: "verified",
          },
        ],
        ingestionChannel: "file_import",
        sourceSystem: "approved-import",
        evidenceRefs: ["evidence:profile-1"],
        verificationState: "verified",
        actorId: "verification-worker",
        reasonCode: "initial_capture",
        idempotencyKey: "verification:profile-1",
      });

      const first = await repository.replace(firstCommand);
      const replay = await repository.replace(firstCommand);
      if (
        first.duplicate ||
        !replay.duplicate ||
        first.record.profileId !== replay.record.profileId ||
        first.record.certificates[0]?.version !== 1
      ) {
        throw new Error("Compliance profile idempotent replay failed");
      }

      const secondCommand = normalizeReplaceProductComplianceProfileCommand({
        ...firstCommand,
        expectedProfileVersion: 1,
        idempotencyKey: "verification:profile-2",
        evidenceRefs: ["evidence:profile-2"],
        certificates: [
          {
            certificateKey: "un38-main",
            certificateType: "un38_3",
            certificateNumber: "UN38-3-001-R1",
            issuerName: "Qualified Laboratory",
            coverageScope: "countries",
            coveredCountryCodes: ["CN", "US"],
            validFrom: "2026-01-01",
            validUntil: "2028-01-01",
            documentRecordId: randomUUID(),
            verificationState: "verified",
          },
        ],
      });
      const second = await repository.replace(secondCommand);
      const current = await repository.findCurrent({
        tenantId: "tenant-a",
        productSkuId,
      });
      const profileCount = await prisma.productComplianceProfile.count({
        where: { tenantId: "tenant-a", productSkuId },
      });
      const activeCount = await prisma.productComplianceProfile.count({
        where: { tenantId: "tenant-a", productSkuId, state: "active" },
      });
      const certificateVersionCount =
        await prisma.productCertificateVersion.count();
      if (
        second.record.version !== 2 ||
        second.record.certificates[0]?.version !== 2 ||
        current?.profileId !== second.record.profileId ||
        profileCount !== 2 ||
        activeCount !== 1 ||
        certificateVersionCount !== 2
      ) {
        throw new Error("Compliance profile version replacement failed");
      }

      await expectRejected(
        () =>
          repository.replace({
            ...secondCommand,
            expectedProfileVersion: 0,
            idempotencyKey: "verification:stale-version",
          }),
        "PRODUCT_COMPLIANCE_PROFILE_VERSION_CONFLICT",
      );
      await expectRejected(
        () =>
          repository.replace(
            normalizeReplaceProductComplianceProfileCommand({
              ...secondCommand,
              sourceSystem: "different-source",
            }),
          ),
        "PRODUCT_COMPLIANCE_PROFILE_IDEMPOTENCY_CONFLICT",
      );
      await expectRejected(
        () =>
          repository.replace({
            ...firstCommand,
            tenantId: "tenant-b",
            expectedProfileVersion: 0,
            idempotencyKey: "verification:cross-tenant",
          }),
        "PRODUCT_COMPLIANCE_PROFILE_SKU_NOT_FOUND",
      );
      await expectRejected(
        () =>
          repository.replace(
            normalizeReplaceProductComplianceProfileCommand({
              ...secondCommand,
              expectedProfileVersion: 2,
              idempotencyKey: "verification:certificate-identity-conflict",
              certificates: [
                {
                  ...secondCommand.certificates[0]!,
                  certificateType: "sds",
                },
              ],
            }),
          ),
        "PRODUCT_CERTIFICATE_IDENTITY_CONFLICT",
      );
      await assertDatabaseTenantConstraint(prisma, productSkuId);
      await assertCrossSkuCertificateReferenceRejected(
        prisma,
        repository,
        second.record.certificates[0]!.certificateVersionId,
      );
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log(
    "Product compliance profiles verified: empty migration, typed profiles, certificate versioning, idempotency, optimistic concurrency and tenant isolation passed.",
  );
}

async function assertSchema(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      profileTable: string | null;
      batteryTable: string | null;
      certificateVersionTable: string | null;
      oneActiveIndex: string | null;
      profileChain: string | null;
      certificateChain: string | null;
    }>
  >`
    SELECT
      to_regclass('public.product_compliance_profile')::text AS "profileTable",
      to_regclass('public.product_battery_profile')::text AS "batteryTable",
      to_regclass('public.product_certificate_version')::text AS "certificateVersionTable",
      to_regclass('public.product_compliance_profile_one_active_key')::text AS "oneActiveIndex",
      (
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = 'product_compliance_profile_supersedes_fkey'
      ) AS "profileChain",
      (
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = 'product_certificate_version_supersedes_fkey'
      ) AS "certificateChain"
  `;
  const row = rows[0];
  if (
    row?.profileTable !== "product_compliance_profile" ||
    row.batteryTable !== "product_battery_profile" ||
    row.certificateVersionTable !== "product_certificate_version" ||
    row.oneActiveIndex !== "product_compliance_profile_one_active_key" ||
    !row.profileChain?.includes("product_sku_id") ||
    !row.certificateChain?.includes("product_certificate_id")
  ) {
    throw new Error("Product compliance profile schema verification failed");
  }
}

async function assertDatabaseTenantConstraint(
  prisma: PrismaClient,
  productSkuId: string,
): Promise<void> {
  let rejected = false;
  try {
    await prisma.productComplianceProfile.create({
      data: {
        id: randomUUID(),
        tenantId: "tenant-b",
        productSkuId,
        version: 1,
        state: "active",
        ingestionChannel: "manual_ui",
        sourceSystem: "verification",
        evidenceRefs: ["evidence:cross-tenant"],
        verificationState: "pending",
        actorId: "verification-worker",
        reasonCode: "cross_tenant_probe",
        idempotencyKey: "verification:cross-tenant-direct",
        payloadHash: "a".repeat(64),
      },
    });
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("Cross-tenant compliance profile was accepted");
  }
}

async function assertCrossSkuCertificateReferenceRejected(
  prisma: PrismaClient,
  repository: PrismaProductComplianceProfileRepository,
  certificateVersionId: string,
): Promise<void> {
  const otherSkuId = randomUUID();
  await prisma.productSku.create({
    data: {
      id: otherSkuId,
      tenantId: "tenant-a",
      productNumber: "SKU-COMPLIANCE-OTHER",
    },
  });
  const otherProfile = await repository.replace(
    normalizeReplaceProductComplianceProfileCommand({
      tenantId: "tenant-a",
      productSkuId: otherSkuId,
      expectedProfileVersion: 0,
      battery: { presenceState: "absent" },
      refrigerant: { presenceState: "absent" },
      dangerousGoods: { classificationState: "not_regulated" },
      inspectionRequirements: [],
      certificates: [],
      ingestionChannel: "manual_ui",
      sourceSystem: "verification",
      evidenceRefs: ["evidence:other-sku"],
      verificationState: "pending",
      actorId: "verification-worker",
      reasonCode: "initial_capture",
      idempotencyKey: "verification:other-sku",
    }),
  );
  let rejected = false;
  try {
    await prisma.productComplianceProfileCertificate.create({
      data: {
        id: randomUUID(),
        tenantId: "tenant-a",
        productSkuId: otherSkuId,
        profileId: otherProfile.record.profileId,
        certificateVersionId,
      },
    });
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("Cross-SKU certificate reference was accepted");
  }
}

async function expectRejected(
  operation: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }
  throw new Error(`Expected rejection: ${expectedMessage}`);
}

async function withTemporaryDatabase(
  source: string,
  suffix: string,
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_compliance_${suffix}_${process.pid}_${Date.now()}`;
  if (
    !/^logix_verify_compliance_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)
  ) {
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
