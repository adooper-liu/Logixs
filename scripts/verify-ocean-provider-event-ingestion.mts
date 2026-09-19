import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaProviderEventIngestionRepository } from "../apps/api/src/modules/ocean-port-visibility/infrastructure/prisma-provider-event-ingestion.repository.js";
import type { ProviderEventIngestionRecord } from "../apps/api/src/modules/ocean-port-visibility/domain/provider-event-ingestion.repository.js";
import { ResolveContainerByNumberService } from "../apps/api/src/modules/shipment-registry/application/resolve-container-by-number.service.js";
import { PrismaContainerRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
await verifyExistingDatabase(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDatabase(url: string): Promise<void> {
  const prisma = createPrisma(url);
  const id = randomUUID();
  const inboxRecordId = randomUUID();
  const messageId = randomUUID();
  const now = new Date();
  const record: ProviderEventIngestionRecord = {
    id,
    inboxRecordId,
    tenantId: "verification-tenant",
    consumerName: "ocean-port-visibility.trackingeyes.container-status.v1",
    messageId,
    provider: "trackingeyes",
    interfaceCode: "trackingeyes.container.status",
    providerEventIdRaw: `verification-${id}`,
    idempotencyKey: `trackingeyes:event:verification-${id}`,
    rawPayload: {
      containerNumber: "TEST0000001",
      rawCode: "DLPT",
      eventTime: now.toISOString(),
    },
    payloadHash: "a".repeat(64),
    payloadHashVersion: "trackingeyes-container-status-canonical-v1",
    containerNumberRaw: "TEST0000001",
    containerRecordId: null,
    objectResolutionState: "not_attempted",
    objectResolutionReasonCode: null,
    rawCode: "DLPT",
    eventTimeRaw: now.toISOString(),
    mappingVersion: "trackingeyes-ocean-reference-2026-09-18",
    normalizationKind: "candidate",
    canonicalEventCode: "departed",
    occurredAt: now,
    timeKind: "actual",
    sourceCodeRaw: "1",
    sourceSignal: "carrier",
    authorityDecision: "review_required",
    authorityPolicyRef: null,
    confidenceState: "unknown",
    reasonCodes: ["source_authority_policy_required"],
    lifecycleApplication: "not_applied",
    decidedBy: "service:database-verification",
    traceId: `verification-${id}`,
    receivedAt: now,
    decidedAt: now,
  };

  try {
    const repository = new PrismaProviderEventIngestionRepository(
      prisma as never,
    );
    await verifyContainerResolution(prisma, id);
    await repository.insertProcessed(record);
    const stored = await repository.findByInboxMessage({
      consumerName: record.consumerName,
      messageId,
    });
    if (
      !stored ||
      stored.id !== id ||
      stored.inboxRecordId !== inboxRecordId ||
      stored.lifecycleApplication !== "not_applied" ||
      stored.authorityDecision !== "review_required" ||
      stored.objectResolutionState !== "not_attempted"
    ) {
      throw new Error("Ocean provider ingestion verification failed");
    }
    console.log(
      "Ocean provider ingestion verified: transaction, read mapping, and lifecycle isolation passed.",
    );
  } finally {
    await prisma.oceanProviderEventIngestion.deleteMany({ where: { id } });
    await prisma.inboxMessage.deleteMany({ where: { id: inboxRecordId } });
    await prisma.$disconnect();
  }
}

async function verifyContainerResolution(
  prisma: PrismaClient,
  verificationId: string,
): Promise<void> {
  const tenantId = `verification-${verificationId}`;
  const containerNumber = `TeSt${verificationId.slice(0, 7)}`;
  const firstId = randomUUID();
  const secondId = randomUUID();
  const repository = new PrismaContainerRepository(prisma as never);
  const service = new ResolveContainerByNumberService(repository);
  try {
    await prisma.containerRecord.create({
      data: {
        id: firstId,
        tenantId,
        orderNumber: `ORDER-${firstId}`,
        containerNumber,
        currentStatus: "not_shipped",
      },
    });
    const resolved = await service.execute({
      tenantId,
      containerNumber: containerNumber.toUpperCase(),
    });
    if (resolved.state !== "resolved" || resolved.containerId !== firstId) {
      throw new Error("Unique container object resolution failed");
    }

    await prisma.containerRecord.create({
      data: {
        id: secondId,
        tenantId,
        orderNumber: `ORDER-${secondId}`,
        containerNumber: containerNumber.toLowerCase(),
        currentStatus: "not_shipped",
      },
    });
    const ambiguous = await service.execute({ tenantId, containerNumber });
    if (ambiguous.state !== "ambiguous") {
      throw new Error("Ambiguous container object resolution was not detected");
    }
  } finally {
    await prisma.containerRecord.deleteMany({ where: { tenantId } });
  }
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  const sourceUrl = new URL(url);
  const databaseName = `logix_verify_ocean_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_ocean_[0-9_]+$/.test(databaseName)) {
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
    const pnpmCli = process.env.npm_execpath;
    if (!pnpmCli) throw new Error("npm_execpath is required to run migrations");
    const migration = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: targetUrl.toString() },
      encoding: "utf8",
      stdio: "pipe",
    });
    if (migration.status !== 0) {
      throw new Error(
        `Empty database migration failed:\n${migration.stdout}\n${migration.stderr}`,
      );
    }

    const target = createPrisma(targetUrl.toString());
    try {
      const rows = await target.$queryRaw<
        Array<{
          tableName: string | null;
          objectResolutionColumn: string | null;
          objectResolutionConstraint: string | null;
        }>
      >`
        SELECT
          to_regclass('public.ocean_provider_event_ingestion')::text AS "tableName",
          (
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'ocean_provider_event_ingestion'
              AND column_name = 'object_resolution_state'
          ) AS "objectResolutionColumn",
          (
            SELECT conname
            FROM pg_constraint
            WHERE conname = 'ocean_provider_ingestion_object_resolution_check'
          ) AS "objectResolutionConstraint"
      `;
      if (
        rows[0]?.tableName !== "ocean_provider_event_ingestion" ||
        rows[0]?.objectResolutionColumn !== "object_resolution_state" ||
        rows[0]?.objectResolutionConstraint !==
          "ocean_provider_ingestion_object_resolution_check"
      ) {
        throw new Error(
          "Empty database migration did not create object resolution schema",
        );
      }
    } finally {
      await target.$disconnect();
    }
    console.log(
      "Ocean provider ingestion verified: empty database migration chain passed.",
    );
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

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
