import type {
  LandingIsolationComparison,
  LandingIsolationProbe,
  LandingIsolationScope,
  LandingIsolationSnapshot,
} from "../domain/landing-isolation-probe.port";

export type LandingIsolationProbeDependencies = {
  captureTargetTenantHash(input: LandingIsolationScope): Promise<string>;
  captureTenantHash(tenantId: string): Promise<string>;
  captureGlobalReferenceHash(): Promise<string>;
  captureTargetReceiptDigest(targetPrefix: string): Promise<string | null>;
  captureMinioOutsideHash(targetPrefix: string): Promise<string>;
  captureTemporalHash(): Promise<string>;
  countLandingOutbox(targetTenantId: string): Promise<number>;
  countBusinessTasks(targetTenantId: string): Promise<number>;
};

export class FullChainLandingIsolationProbe implements LandingIsolationProbe {
  constructor(private readonly deps: LandingIsolationProbeDependencies) {}

  async capture(
    input: LandingIsolationScope,
  ): Promise<LandingIsolationSnapshot> {
    const [
      targetTenantHash,
      oldDemoTenantHash,
      controlTenantHash,
      globalReferenceHash,
      targetReceiptDigest,
      minioOutsideHash,
      temporalHash,
      landingOutboxCount,
      businessTaskCount,
    ] = await Promise.all([
      this.deps.captureTargetTenantHash(input),
      this.deps.captureTenantHash(input.oldDemoTenantId),
      this.deps.captureTenantHash(input.controlTenantId),
      this.deps.captureGlobalReferenceHash(),
      this.deps.captureTargetReceiptDigest(input.targetPrefix),
      this.deps.captureMinioOutsideHash(input.targetPrefix),
      this.deps.captureTemporalHash(),
      this.deps.countLandingOutbox(input.targetTenantId),
      this.deps.countBusinessTasks(input.targetTenantId),
    ]);
    return {
      targetTenantHash,
      oldDemoTenantHash,
      controlTenantHash,
      globalReferenceHash,
      targetReceiptDigest,
      minioOutsideHash,
      temporalHash,
      landingOutboxCount,
      businessTaskCount,
    };
  }

  compare(
    before: LandingIsolationSnapshot,
    after: LandingIsolationSnapshot,
  ): LandingIsolationComparison {
    const outboxDelta = after.landingOutboxCount - before.landingOutboxCount;
    if (
      before.oldDemoTenantHash !== after.oldDemoTenantHash ||
      before.controlTenantHash !== after.controlTenantHash ||
      before.globalReferenceHash !== after.globalReferenceHash ||
      before.minioOutsideHash !== after.minioOutsideHash ||
      before.temporalHash !== after.temporalHash ||
      before.businessTaskCount !== after.businessTaskCount ||
      outboxDelta < 0 ||
      outboxDelta > 1
    )
      throw new Error("FULL_CHAIN_ISOLATION_VIOLATION");
    return {
      targetChanged: before.targetTenantHash !== after.targetTenantHash,
      receiptChanged: before.targetReceiptDigest !== after.targetReceiptDigest,
      outboxDelta,
    };
  }
}
