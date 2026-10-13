import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUserIdentity } from "../../identity";
import { FullChainLandingPolicy } from "./full-chain-landing-policy";
import { GetFullChainLandingService } from "./get-full-chain-landing.service";
import { GetFullChainChainService } from "./get-full-chain-chain.service";

const TENANT = "rehearsal-tenant";
const identity = (
  capabilities = ["import.read"],
): AuthenticatedUserIdentity => ({
  actorType: "user",
  actorId: "actor-1",
  tenantId: TENANT,
  authenticationMethod: "oidc",
  roles: ["import_operator"],
  capabilities,
});
const policy = new FullChainLandingPolicy({
  rehearsalTenantId: TENANT,
  oldDemoTenantId: "demo-real-sample-20260921",
  controlTenantId: "control",
  prefixRoot: "rehearsal",
});

describe("full-chain landing read services", () => {
  it("reads tenant-scoped redacted status with import.read", async () => {
    const repository = {
      getStatus: vi.fn(async () => ({
        runId: "run-1",
        state: "published",
        inputCounts: { shipment_plan: 1 },
        appliedCounts: { shipment_plan: 1 },
        replayedCounts: {},
        rejectedCounts: {},
        gapCount: 0,
        checkCount: 1,
        publishedAt: new Date("2026-10-13T00:00:00.000Z"),
      })),
    };
    const service = new GetFullChainLandingService(policy, repository as never);
    expect(await service.execute(identity(), "run-1")).toMatchObject({
      runId: "run-1",
      state: "published",
      gapCount: 0,
    });
    expect(repository.getStatus).toHaveBeenCalledWith({
      tenantId: TENANT,
      runId: "run-1",
    });
  });

  it("returns not found for missing or unpublished chain", async () => {
    const repository = { getChain: vi.fn(async () => null) };
    const service = new GetFullChainChainService(policy, repository as never);
    await expect(
      service.execute(identity(), "run-1", "PLAN-1"),
    ).rejects.toThrow(/FULL_CHAIN_LANDING_NOT_FOUND/);
  });

  it("rejects reads without import.read before repository access", async () => {
    const repository = {
      getStatus: vi.fn(),
      getChain: vi.fn(),
    };
    const status = new GetFullChainLandingService(policy, repository as never);
    const chain = new GetFullChainChainService(policy, repository as never);
    await expect(status.execute(identity([]), "run-1")).rejects.toThrow(
      /FULL_CHAIN_REHEARSAL_ACCESS_DENIED/,
    );
    await expect(
      chain.execute(identity([]), "run-1", "PLAN-1"),
    ).rejects.toThrow(/FULL_CHAIN_REHEARSAL_ACCESS_DENIED/);
    expect(repository.getStatus).not.toHaveBeenCalled();
    expect(repository.getChain).not.toHaveBeenCalled();
  });
});
