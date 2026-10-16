import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../../config/env";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { ApplyFullChainPackageService } from "./application/apply-full-chain-package.service";
import { FullChainLandingPolicy } from "./application/full-chain-landing-policy";
import { GetFullChainChainService } from "./application/get-full-chain-chain.service";
import { GetFullChainLandingService } from "./application/get-full-chain-landing.service";
import { FULL_CHAIN_LANDING_REPOSITORY } from "./domain/full-chain-landing.repository";
import { LANDING_ISOLATION_PROBE } from "./domain/landing-isolation-probe.port";
import { LANDING_RECEIPT_STORE } from "./domain/landing-receipt-store.port";
import { FullChainLandingIsolationProbe } from "./infrastructure/full-chain-landing-isolation.probe";
import { LandingRuntimeIsolationDependencies } from "./infrastructure/landing-runtime-isolation.dependencies";
import { PrismaFullChainLandingRepository } from "./infrastructure/prisma-full-chain-landing.repository";
import { S3LandingReceiptStore } from "./infrastructure/s3-landing-receipt.store";
import { FullChainSampleLandingController } from "./presentation/full-chain-sample-landing.controller";

export const FULL_CHAIN_LANDING_POLICY = Symbol("FULL_CHAIN_LANDING_POLICY");

@Module({
  imports: [IdentityModule],
  controllers: [FullChainSampleLandingController],
  providers: [
    PrismaFullChainLandingRepository,
    LandingRuntimeIsolationDependencies,
    {
      provide: FULL_CHAIN_LANDING_POLICY,
      useFactory: () =>
        new FullChainLandingPolicy({
          rehearsalTenantId: process.env.FULL_CHAIN_REHEARSAL_TENANT_ID ?? "",
          oldDemoTenantId: "demo-real-sample-20260921",
          controlTenantId:
            process.env.FULL_CHAIN_REHEARSAL_CONTROL_TENANT_ID ?? "",
          prefixRoot: "rehearsal",
        }),
    },
    {
      provide: FULL_CHAIN_LANDING_REPOSITORY,
      useExisting: PrismaFullChainLandingRepository,
    },
    {
      provide: LANDING_RECEIPT_STORE,
      useFactory: () => {
        const storage = config.importSourceStorage;
        const client = new S3Client({
          endpoint: storage.endpoint,
          region: storage.region,
          forcePathStyle: storage.forcePathStyle,
          credentials: {
            accessKeyId: storage.accessKey,
            secretAccessKey: storage.secretKey,
          },
        });
        return new S3LandingReceiptStore(client, storage.bucket, {
          rehearsalTenantId: process.env.FULL_CHAIN_REHEARSAL_TENANT_ID ?? "",
          oldDemoTenantId: "demo-real-sample-20260921",
          prefixRoot: "rehearsal",
        });
      },
    },
    {
      provide: LANDING_ISOLATION_PROBE,
      inject: [LandingRuntimeIsolationDependencies],
      useFactory: (dependencies: LandingRuntimeIsolationDependencies) =>
        new FullChainLandingIsolationProbe(dependencies.create()),
    },
    {
      provide: ApplyFullChainPackageService,
      inject: [
        FULL_CHAIN_LANDING_POLICY,
        FULL_CHAIN_LANDING_REPOSITORY,
        LANDING_RECEIPT_STORE,
        LANDING_ISOLATION_PROBE,
      ],
      useFactory: (
        policy: FullChainLandingPolicy,
        repository: PrismaFullChainLandingRepository,
        receiptStore: S3LandingReceiptStore,
        isolationProbe: FullChainLandingIsolationProbe,
      ) =>
        new ApplyFullChainPackageService(
          policy,
          repository,
          receiptStore,
          isolationProbe,
        ),
    },
    {
      provide: GetFullChainLandingService,
      inject: [FULL_CHAIN_LANDING_POLICY, FULL_CHAIN_LANDING_REPOSITORY],
      useFactory: (
        policy: FullChainLandingPolicy,
        repository: PrismaFullChainLandingRepository,
      ) => new GetFullChainLandingService(policy, repository),
    },
    {
      provide: GetFullChainChainService,
      inject: [FULL_CHAIN_LANDING_POLICY, FULL_CHAIN_LANDING_REPOSITORY],
      useFactory: (
        policy: FullChainLandingPolicy,
        repository: PrismaFullChainLandingRepository,
      ) => new GetFullChainChainService(policy, repository),
    },
  ],
  exports: [GetFullChainLandingService, GetFullChainChainService],
})
export class FullChainSampleLandingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(FullChainSampleLandingController);
  }
}
