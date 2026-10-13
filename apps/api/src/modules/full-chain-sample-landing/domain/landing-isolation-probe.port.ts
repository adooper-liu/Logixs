export const LANDING_ISOLATION_PROBE = Symbol("LANDING_ISOLATION_PROBE");

export type LandingIsolationScope = {
  targetTenantId: string;
  oldDemoTenantId: string;
  controlTenantId: string;
  targetPrefix: string;
};
export type LandingIsolationSnapshot = {
  targetTenantHash: string;
  oldDemoTenantHash: string;
  controlTenantHash: string;
  globalReferenceHash: string;
  targetReceiptDigest: string | null;
  minioOutsideHash: string;
  temporalHash: string;
  landingOutboxCount: number;
  businessTaskCount: number;
};
export type LandingIsolationComparison = {
  targetChanged: boolean;
  receiptChanged: boolean;
  outboxDelta: number;
};

export interface LandingIsolationProbe {
  capture(input: LandingIsolationScope): Promise<LandingIsolationSnapshot>;
  compare(
    before: LandingIsolationSnapshot,
    after: LandingIsolationSnapshot,
  ): LandingIsolationComparison;
}
