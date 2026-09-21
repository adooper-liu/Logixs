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
import {
  buildCargoReadyAssessment,
  normalizeCargoReadyDecision,
} from "../apps/api/src/modules/compliance-management/domain/cargo-ready-compliance.js";
import { normalizeComplianceRuleVersion } from "../apps/api/src/modules/compliance-management/domain/compliance-rule.js";
import { PrismaCargoReadyComplianceRepository } from "../apps/api/src/modules/compliance-management/infrastructure/prisma-cargo-ready-compliance.repository.js";
import { PrismaComplianceRuleRepository } from "../apps/api/src/modules/compliance-management/infrastructure/prisma-compliance-rule.repository.js";
import { normalizeExternalWorkItemProjection } from "../apps/api/src/modules/work-execution/domain/external-work-item.js";
import { PrismaExternalWorkItemRepository } from "../apps/api/src/modules/work-execution/infrastructure/prisma-external-work-item.repository.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260920223000_add_cargo_ready_compliance";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(
      join(tmpdir(), "logix-cargo-ready-upgrade-"),
    );
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      const legacy = createPrisma(targetUrl);
      const containerId = randomUUID();
      try {
        await legacy.containerRecord.create({
          data: {
            id: containerId,
            tenantId: "legacy-tenant",
            orderNumber: "LEGACY-CARGO-READY",
            currentStatus: "not_shipped",
          },
        });
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);
      const upgraded = createPrisma(targetUrl);
      try {
        await assertSchema(upgraded);
        const container = await upgraded.containerRecord.findUnique({
          where: { id: containerId },
        });
        const assessmentCount =
          await upgraded.cargoReadyComplianceAssessment.count();
        const ruleCount = await upgraded.complianceRuleVersion.count();
        if (!container || assessmentCount !== 0 || ruleCount !== 0) {
          throw new Error(
            "Cargo-ready migration guessed compliance rules or assessments",
          );
        }
      } finally {
        await upgraded.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Cargo-ready compliance verified: existing containers upgraded without guessed assessments or decisions.",
  );
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const prisma = createPrisma(targetUrl);
    try {
      await assertSchema(prisma);
      const repository = new PrismaCargoReadyComplianceRepository(
        prisma as never,
      );
      const ruleRepository = new PrismaComplianceRuleRepository(
        prisma as never,
      );
      const workItemRepository = new PrismaExternalWorkItemRepository(
        prisma as never,
      );
      const tenantId = "tenant-a";
      const containerRecordId = randomUUID();
      const productSkuId = randomUUID();
      const rule = normalizeComplianceRuleVersion({
        tenantId,
        ruleCode: "US_CARGO_READY_BASELINE",
        expectedVersion: 0,
        requirementLayer: "law_regulation",
        jurisdictionCountryCode: "US",
        effectiveFrom: "2026-01-01",
        appliesToAllSkus: true,
        productSkuIds: [],
        requiredCertificateTypes: [],
        blockingNodeCodes: ["cargo_ready"],
        severity: "high",
        officialSourceUrl: "https://example.gov/cargo-ready",
        legalCitation: "Example Act 1",
        owner: "verification-compliance",
        evidenceRefs: [randomUUID()],
        actorId: "verification-reviewer",
        reasonCode: "INITIAL_PUBLICATION",
        idempotencyKey: "verification:rule:v1",
      });
      const publishedRule = await ruleRepository.publish(rule);
      const ruleReplay = await ruleRepository.publish(rule);
      if (
        publishedRule.duplicate ||
        !ruleReplay.duplicate ||
        publishedRule.record.ruleVersionId !== ruleReplay.record.ruleVersionId
      ) {
        throw new Error("Compliance rule publication idempotency failed");
      }
      const first = buildCargoReadyAssessment({
        command: {
          tenantId,
          containerRecordId,
          jurisdictionCountryCode: "US",
          assessmentDate: "2026-09-20",
          expectedAssessmentVersion: 0,
          evidenceRefs: [randomUUID()],
          actorId: "verification-reviewer",
          reasonCode: "INITIAL_REVIEW",
          idempotencyKey: "verification:assessment:v1",
        },
        scope: {
          allocationSetId: randomUUID(),
          allocationSetVersion: 1,
          items: [
            {
              replenishmentOrderLineId: randomUUID(),
              productSkuId,
              productNumber: "SKU-READY-1",
            },
          ],
        },
        profiles: new Map([
          [
            productSkuId,
            {
              profileId: randomUUID(),
              version: 1,
              verificationState: "verified",
              battery: { presenceState: "absent" },
              refrigerant: { presenceState: "absent" },
              dangerousGoods: { classificationState: "not_regulated" },
              inspectionRequirements: [],
              certificates: [],
            },
          ],
        ]),
        ruleEvaluation: {
          ruleSnapshots: [
            {
              ruleVersionId: publishedRule.record.ruleVersionId,
              ruleCode: publishedRule.record.ruleCode,
              version: publishedRule.record.version,
              productSkuId,
              requirementLayer: publishedRule.record.requirementLayer,
              requiredCertificateTypes:
                publishedRule.record.requiredCertificateTypes,
              blockingNodeCodes: publishedRule.record.blockingNodeCodes,
              severity: publishedRule.record.severity,
              officialSourceUrl: publishedRule.record.officialSourceUrl,
              legalCitation: publishedRule.record.legalCitation,
            },
          ],
          findings: [],
        },
      });
      const saved = await repository.replaceAssessment(first);
      const replay = await repository.replaceAssessment(first);
      if (
        saved.duplicate ||
        !replay.duplicate ||
        saved.record.assessmentId !== replay.record.assessmentId ||
        saved.record.state !== "ready_for_decision"
      ) {
        throw new Error("Cargo-ready assessment idempotency failed");
      }

      const decision = normalizeCargoReadyDecision({
        tenantId,
        containerRecordId,
        assessmentId: saved.record.assessmentId,
        expectedDecisionVersion: 0,
        decisionCode: "approved",
        evidenceRefs: [randomUUID()],
        actorId: "verification-reviewer",
        reasonCode: "REVIEW_APPROVED",
        idempotencyKey: "verification:decision:v1",
      });
      const decided = await repository.decide(decision);
      const decisionReplay = await repository.decide(decision);
      if (
        decided.duplicate ||
        !decisionReplay.duplicate ||
        decided.record.currentDecision?.decisionCode !== "approved"
      ) {
        throw new Error("Cargo-ready decision or replay failed");
      }

      await expectRejected(
        () =>
          repository.replaceAssessment({
            ...first,
            expectedAssessmentVersion: 0,
            idempotencyKey: "verification:assessment:stale",
          }),
        "CARGO_READY_ASSESSMENT_VERSION_CONFLICT",
      );
      await expectRejected(
        () =>
          repository.decide(
            normalizeCargoReadyDecision({
              tenantId,
              containerRecordId,
              assessmentId: saved.record.assessmentId,
              expectedDecisionVersion: 0,
              evidenceRefs: decision.evidenceRefs,
              actorId: decision.actorId,
              reasonCode: decision.reasonCode,
              idempotencyKey: decision.idempotencyKey,
              decisionCode: "blocked",
            }),
          ),
        "CARGO_READY_DECISION_IDEMPOTENCY_CONFLICT",
      );
      await expectRejected(
        () =>
          repository.decide(
            normalizeCargoReadyDecision({
              tenantId,
              containerRecordId: randomUUID(),
              assessmentId: saved.record.assessmentId,
              expectedDecisionVersion: 1,
              evidenceRefs: [randomUUID()],
              actorId: "verification-reviewer",
              reasonCode: "SCOPE_PROBE",
              idempotencyKey: "verification:decision:scope-probe",
              decisionCode: "blocked",
            }),
          ),
        "CARGO_READY_ASSESSMENT_SCOPE_MISMATCH",
      );

      const second = await repository.replaceAssessment({
        ...first,
        expectedAssessmentVersion: 1,
        allocationSetId: randomUUID(),
        allocationSetVersion: 2,
        idempotencyKey: "verification:assessment:v2",
        payloadHash: "b".repeat(64),
      });
      const versions = await prisma.cargoReadyComplianceAssessment.findMany({
        where: { tenantId, containerRecordId },
        orderBy: { version: "asc" },
        select: { version: true, state: true, supersedesAssessmentId: true },
      });
      if (
        second.record.version !== 2 ||
        versions[0]?.state !== "superseded" ||
        versions[1]?.supersedesAssessmentId !== saved.record.assessmentId
      ) {
        throw new Error("Cargo-ready assessment version chain failed");
      }

      const firstProjection = normalizeExternalWorkItemProjection({
        tenantId,
        sourceModule: "compliance-management",
        sourceType: "cargo_ready_compliance_assessment",
        sourceScopeId: `container:${containerRecordId}:cargo_ready`,
        sourceRecordId: second.record.assessmentId,
        sourceVersion: second.record.version,
        containerId: containerRecordId,
        items: [
          {
            sourceItemKey: "REQUIRED_CERTIFICATE_MISSING_OR_INVALID:sku:0",
            taskDefinitionKey:
              "compliance-remediation:REQUIRED_CERTIFICATE_MISSING_OR_INVALID",
            title: "补齐或核验证书",
            detail: "certificate evidence is missing",
            priority: "high",
            assignedRoleCode: "review_supervisor",
            evidenceRefs: second.record.evidenceRefs,
          },
        ],
      });
      const projected =
        await workItemRepository.replaceProjection(firstProjection);
      const projectionReplay =
        await workItemRepository.replaceProjection(firstProjection);
      if (
        projected.created !== 1 ||
        projected.duplicate ||
        projectionReplay.created !== 0 ||
        !projectionReplay.duplicate
      ) {
        throw new Error("Compliance remediation projection is not idempotent");
      }
      const clearedProjection = normalizeExternalWorkItemProjection({
        ...firstProjection,
        sourceRecordId: randomUUID(),
        sourceVersion: firstProjection.sourceVersion + 1,
        items: [],
      });
      const cleared =
        await workItemRepository.replaceProjection(clearedProjection);
      const cancelledCount = await prisma.externalWorkItem.count({
        where: { tenantId, state: "cancelled" },
      });
      if (cleared.cancelled !== 1 || cancelledCount !== 1) {
        throw new Error("Resolved compliance remediation was not cancelled");
      }
      await expectRejected(
        () => workItemRepository.replaceProjection(firstProjection),
        "EXTERNAL_WORK_ITEM_PROJECTION_STALE",
      );

      let conditionalWithoutObligationRejected = false;
      try {
        await prisma.cargoReadyComplianceDecision.create({
          data: {
            id: randomUUID(),
            tenantId,
            assessmentId: second.record.assessmentId,
            version: 1,
            decisionCode: "approved_with_conditions",
            conditionRefs: [],
            evidenceRefs: [randomUUID()],
            actorId: "verification-reviewer",
            reasonCode: "INVALID_CONDITIONAL_APPROVAL",
            idempotencyKey: "verification:invalid-conditional",
            payloadHash: "d".repeat(64),
          },
        });
      } catch {
        conditionalWithoutObligationRejected = true;
      }
      if (!conditionalWithoutObligationRejected) {
        throw new Error(
          "Conditional approval without obligations was accepted",
        );
      }

      await assertCrossTenantSupersessionRejected(
        prisma,
        second.record.assessmentId,
        containerRecordId,
      );

      const secondRule = await ruleRepository.publish({
        ...rule,
        expectedVersion: 1,
        reasonCode: "SOURCE_UPDATED",
        idempotencyKey: "verification:rule:v2",
        payloadHash: "e".repeat(64),
      });
      const ruleVersions = await prisma.complianceRuleVersion.findMany({
        where: { tenantId },
        orderBy: { version: "asc" },
        select: { version: true, state: true, supersedesRuleVersionId: true },
      });
      if (
        secondRule.record.version !== 2 ||
        ruleVersions[0]?.state !== "retired" ||
        ruleVersions[1]?.supersedesRuleVersionId !==
          publishedRule.record.ruleVersionId
      ) {
        throw new Error("Compliance rule version chain failed");
      }
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log(
    "Cargo-ready compliance verified: empty migration, versioned rules/assessments, append-only decisions, idempotency, concurrency and tenant constraints passed.",
  );
}

async function assertSchema(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      assessmentTable: string | null;
      decisionTable: string | null;
      ruleTable: string | null;
      workItemTable: string | null;
      workItemProjectionTable: string | null;
      oneCurrentAssessment: string | null;
      oneCurrentDecision: string | null;
      onePublishedRule: string | null;
    }>
  >`
    SELECT
      to_regclass('public.cargo_ready_compliance_assessment')::text AS "assessmentTable",
      to_regclass('public.cargo_ready_compliance_decision')::text AS "decisionTable",
      to_regclass('public.compliance_rule_version')::text AS "ruleTable",
      to_regclass('public.external_work_item')::text AS "workItemTable",
      to_regclass('public.external_work_item_projection')::text AS "workItemProjectionTable",
      to_regclass('public.cargo_ready_assessment_one_current_key')::text AS "oneCurrentAssessment",
      to_regclass('public.cargo_ready_decision_one_current_key')::text AS "oneCurrentDecision",
      to_regclass('public.compliance_rule_version_one_published_key')::text AS "onePublishedRule"
  `;
  const row = rows[0];
  if (
    row?.assessmentTable !== "cargo_ready_compliance_assessment" ||
    row.decisionTable !== "cargo_ready_compliance_decision" ||
    row.ruleTable !== "compliance_rule_version" ||
    row.workItemTable !== "external_work_item" ||
    row.workItemProjectionTable !== "external_work_item_projection" ||
    row.oneCurrentAssessment !== "cargo_ready_assessment_one_current_key" ||
    row.oneCurrentDecision !== "cargo_ready_decision_one_current_key" ||
    row.onePublishedRule !== "compliance_rule_version_one_published_key"
  ) {
    throw new Error("Cargo-ready compliance schema verification failed");
  }
}

async function assertCrossTenantSupersessionRejected(
  prisma: PrismaClient,
  assessmentId: string,
  containerRecordId: string,
): Promise<void> {
  let rejected = false;
  try {
    await prisma.cargoReadyComplianceAssessment.create({
      data: {
        id: randomUUID(),
        tenantId: "tenant-b",
        containerRecordId,
        version: 99,
        state: "ready_for_decision",
        jurisdictionCountryCode: "US",
        assessmentDate: new Date("2026-09-20T00:00:00.000Z"),
        allocationSetId: randomUUID(),
        allocationSetVersion: 1,
        supersedesAssessmentId: assessmentId,
        evidenceRefs: [randomUUID()],
        actorId: "verification-reviewer",
        reasonCode: "CROSS_TENANT_PROBE",
        idempotencyKey: "verification:cross-tenant",
        payloadHash: "c".repeat(64),
      },
    });
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("Cross-tenant cargo-ready supersession was accepted");
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
  const databaseName = `logix_verify_cargo_ready_${suffix}_${process.pid}_${Date.now()}`;
  if (
    !/^logix_verify_cargo_ready_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)
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
  const result = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `Database migration failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
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
