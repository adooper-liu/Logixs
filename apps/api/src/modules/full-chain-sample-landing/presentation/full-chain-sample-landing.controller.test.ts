import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { describe, expect, it, vi } from "vitest";
import type { ApplyFullChainPackageCommand } from "../application/apply-full-chain-package.service";
import { createValidFullChainPackage } from "../test-support/full-chain-package.fixture";
import { FullChainSampleLandingController } from "./full-chain-sample-landing.controller";

const identity: ApplyFullChainPackageCommand["identity"] = {
  actorType: "user",
  actorId: "actor-1",
  tenantId: "rehearsal-tenant",
  authenticationMethod: "oidc",
  roles: ["import_operator"],
  capabilities: ["import.read", "import.execute"],
};

function capabilities(method: keyof FullChainSampleLandingController) {
  return Reflect.getMetadata(
    REQUIRED_CAPABILITIES_KEY,
    FullChainSampleLandingController.prototype[method],
  );
}

describe("FullChainSampleLandingController", () => {
  it("declares write and read capabilities on every route", () => {
    expect(capabilities("apply")).toEqual(["import.execute"]);
    expect(capabilities("status")).toEqual(["import.read"]);
    expect(capabilities("chain")).toEqual(["import.read"]);
  });

  it("forwards only authenticated identity and package command", async () => {
    const applyService = {
      execute: vi.fn(async () => ({ state: "published" })),
    };
    const controller = new FullChainSampleLandingController(
      applyService as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
    );
    const artifacts = createValidFullChainPackage();
    await controller.apply({ identity }, {
      artifacts,
      idempotencyKey: "req-1",
      traceId: "trace-1",
      tenantId: "attempted-override",
    } as never);
    expect(applyService.execute).toHaveBeenCalledWith({
      identity,
      artifacts,
      idempotencyKey: "req-1",
      traceId: "trace-1",
    });
  });

  it("forwards tenant-scoped status and chain reads", async () => {
    const statusService = { execute: vi.fn(async () => ({ runId: "run-1" })) };
    const chainService = {
      execute: vi.fn(async () => ({ planNumber: "PLAN-1" })),
    };
    const controller = new FullChainSampleLandingController(
      { execute: vi.fn() } as never,
      statusService as never,
      chainService as never,
    );
    await controller.status({ identity }, "run-1");
    await controller.chain({ identity }, "run-1", "PLAN-1");
    expect(statusService.execute).toHaveBeenCalledWith(identity, "run-1");
    expect(chainService.execute).toHaveBeenCalledWith(
      identity,
      "run-1",
      "PLAN-1",
    );
  });
});
