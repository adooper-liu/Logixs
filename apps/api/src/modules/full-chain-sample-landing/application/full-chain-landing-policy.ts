import type { AuthenticatedUserIdentity } from "../../identity";

export type FullChainLandingPolicyConfig = {
  rehearsalTenantId: string;
  oldDemoTenantId: string;
  controlTenantId: string;
  prefixRoot: "rehearsal" | "demo-switch";
  mode?: "rehearsal" | "demo_switch";
};

export class FullChainLandingPolicy {
  constructor(readonly config: FullChainLandingPolicyConfig) {}

  assertCanApply(identity: AuthenticatedUserIdentity): void {
    const demoSwitch = this.config.mode === "demo_switch";
    if (
      !identity.capabilities.includes("import.execute") ||
      identity.tenantId !== this.config.rehearsalTenantId ||
      (!demoSwitch && identity.tenantId === this.config.oldDemoTenantId) ||
      identity.tenantId === this.config.controlTenantId ||
      this.config.prefixRoot !== (demoSwitch ? "demo-switch" : "rehearsal")
    )
      throw new Error("FULL_CHAIN_REHEARSAL_ACCESS_DENIED");
  }

  assertCanRead(identity: AuthenticatedUserIdentity): void {
    if (
      !identity.capabilities.includes("import.read") ||
      (identity.tenantId !== this.config.rehearsalTenantId &&
        identity.tenantId !== this.config.oldDemoTenantId)
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
