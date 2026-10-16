import { describe, expect, it } from "vitest";
import type { AuthenticatedUserIdentity } from "../../identity";
import { FullChainLandingPolicy } from "./full-chain-landing-policy";

const REHEARSAL_TENANT = "rehearsal-tenant";
const OLD_DEMO_TENANT = "demo-real-sample-20260921";

function identity(
  tenantId: string,
  capabilities: string[],
): AuthenticatedUserIdentity {
  return {
    actorType: "user",
    actorId: "actor-1",
    tenantId,
    authenticationMethod: "oidc",
    roles: ["import_operator"],
    capabilities,
  };
}

describe("FullChainLandingPolicy", () => {
  const policy = new FullChainLandingPolicy({
    rehearsalTenantId: REHEARSAL_TENANT,
    oldDemoTenantId: OLD_DEMO_TENANT,
    controlTenantId: "control-tenant",
    prefixRoot: "rehearsal",
  });

  it.each([
    identity(OLD_DEMO_TENANT, ["import.execute"]),
    identity("another-tenant", ["import.execute"]),
    identity(REHEARSAL_TENANT, []),
  ])("rejects old-demo, other-tenant, or missing-capability writes", (user) => {
    expect(() => policy.assertCanApply(user)).toThrowError(
      /FULL_CHAIN_REHEARSAL_ACCESS_DENIED/,
    );
  });

  it("accepts only import.execute on the configured rehearsal tenant", () => {
    expect(() =>
      policy.assertCanApply(identity(REHEARSAL_TENANT, ["import.execute"])),
    ).not.toThrow();
    expect(policy.scope("run-1")).toEqual({
      targetTenantId: REHEARSAL_TENANT,
      oldDemoTenantId: OLD_DEMO_TENANT,
      controlTenantId: "control-tenant",
      targetPrefix: "rehearsal/rehearsal-tenant/run-1",
    });
  });

  it("separates read capability from write capability", () => {
    expect(() =>
      policy.assertCanRead(identity(REHEARSAL_TENANT, ["import.read"])),
    ).not.toThrow();
    expect(() =>
      policy.assertCanRead(identity(REHEARSAL_TENANT, ["import.execute"])),
    ).toThrowError(/FULL_CHAIN_REHEARSAL_ACCESS_DENIED/);
  });
});
