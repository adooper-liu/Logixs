import { randomUUID } from "node:crypto";
import path from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import {
  readFullChainPackageDirectory,
  type FullChainPackageArtifacts,
} from "@logix/full-chain-sample-contracts";
import { config } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUserIdentity } from "../../modules/identity";
import { ReplaceReplenishmentOrderLinesService } from "../../modules/shipment-registry";
import { PrismaReplaceReplenishmentOrderLinesRepository } from "../../modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository";
import { ApplyFullChainPackageService } from "../../modules/full-chain-sample-landing/application/apply-full-chain-package.service";
import { FullChainLandingPolicy } from "../../modules/full-chain-sample-landing/application/full-chain-landing-policy";
import { FullChainLandingIsolationProbe } from "../../modules/full-chain-sample-landing/infrastructure/full-chain-landing-isolation.probe";
import { FullChainCargoReadyProjector } from "../../modules/full-chain-sample-landing/infrastructure/full-chain-cargo-ready.projector";
import { createLandingIsolationProbeDependencies } from "../../modules/full-chain-sample-landing/infrastructure/landing-runtime-isolation.dependencies";
import { PrismaFullChainLandingRepository } from "../../modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository";
import { S3LandingReceiptStore } from "../../modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store";

const TARGET_TENANT = "demo-real-sample-20260921";

type Options = {
  packagePath: string;
  approvedRoot: string;
  idempotencyKey: string;
};

function parse(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("FULL_CHAIN_DEMO_SWITCH_ARGUMENTS_INVALID");
    values.set(key, value);
  }
  const result = {
    packagePath: values.get("--package"),
    approvedRoot: values.get("--approved-root"),
    idempotencyKey: values.get("--idempotency-key"),
  };
  if (Object.values(result).some((value) => !value) || values.size !== 3)
    throw new Error("FULL_CHAIN_DEMO_SWITCH_ARGUMENTS_INVALID");
  return result as Options;
}

function identity(): AuthenticatedUserIdentity {
  return {
    actorType: "user",
    actorId: "demo-switch-operator",
    tenantId: TARGET_TENANT,
    authenticationMethod: "development_headers",
    roles: ["import_operator"],
    capabilities: ["import.execute", "import.read"],
  };
}

export async function run(argv = process.argv.slice(2)) {
  const options = parse(argv);
  const artifacts: FullChainPackageArtifacts =
    await readFullChainPackageDirectory({
      packagePath: options.packagePath,
      approvedRoot: options.approvedRoot,
      repositoryRoot: path.resolve(__dirname, "../../../../../"),
    });
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const policyConfig = {
      rehearsalTenantId: TARGET_TENANT,
      oldDemoTenantId: "full-chain-control",
      controlTenantId: "full-chain-control",
      prefixRoot: "demo-switch" as const,
      mode: "demo_switch" as const,
    };
    const storage = config.importSourceStorage;
    const s3 = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
    });
    try {
      const replaceLines = new ReplaceReplenishmentOrderLinesService(
        new PrismaReplaceReplenishmentOrderLinesRepository(prisma),
      );
      const service = new ApplyFullChainPackageService(
        new FullChainLandingPolicy(policyConfig),
        new PrismaFullChainLandingRepository(prisma),
        new S3LandingReceiptStore(s3, storage.bucket, policyConfig),
        new FullChainLandingIsolationProbe(
          createLandingIsolationProbeDependencies(prisma),
        ),
        undefined,
        new FullChainCargoReadyProjector(replaceLines),
      );
      const result = await service.execute({
        identity: identity(),
        artifacts,
        idempotencyKey: options.idempotencyKey,
        traceId: randomUUID(),
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return result;
    } finally {
      s3.destroy();
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module)
  run().catch((error) => {
    const message = error instanceof Error ? error.message : "";
    const safeReconciliation =
      /^FULL_CHAIN_RECONCILIATION_FAILED:[a-z0-9_:,]+$/u.test(message)
        ? message
        : null;
    const candidate = message.split(":", 1)[0];
    const code =
      safeReconciliation ??
      (/^[A-Z][A-Z0-9_]+$/u.test(candidate)
        ? candidate
        : "FULL_CHAIN_DEMO_SWITCH_FAILED");
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
