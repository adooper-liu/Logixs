import type { AuthenticatedUserIdentity } from "../../identity";

export type FullChainLandingPolicyConfig = {
  rehearsalTenantId: string;
  oldDemoTenantId: string;
  controlTenantId: string;
  prefixRoot: string;
};

export class FullChainLandingPolicy {
  constructor(readonly config: FullChainLandingPolicyConfig) {}

  assertCanApply(identity: AuthenticatedUserIdentity): void {
    if (
      !identity.capabilities.includes("import.execute") ||
      identity.tenantId !== this.config.rehearsalTenantId ||
      identity.tenantId === this.config.oldDemoTenantId ||
      identity.tenantId === this.config.controlTenantId ||
      this.config.prefixRoot !== "rehearsal"
    )
      throw new Error("FULL_CHAIN_REHEARSAL_ACCESS_DENIED");
  }

  assertCanRead(identity: AuthenticatedUserIdentity): void {
    if (
      !identity.capabilities.includes("import.read") ||
      identity.tenantId !== this.config.rehearsalTenantId
    )
      throw new Error("FULL_CHAIN_REHEARSAL_ACCESS_DENIED");
  }

  scope(runId: string) {
    const tenantId = this.config.rehearsalTenantId;
    return {
      targetTenantId: tenantId,
      oldDemoTenantId: this.config.oldDemoTenantId,
      controlTenantId: this.config.controlTenantId,
      targetPrefix: `${this.config.prefixRoot}/${tenantId}/${runId}`,
    };
  }
}
