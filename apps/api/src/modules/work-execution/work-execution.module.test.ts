import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { moduleManifest } from "./module.manifest";
import { RECONCILE_APPLIED_LIFECYCLE_FACT } from "./reconcile-applied-lifecycle-fact.port";
import { WorkExecutionModule } from "./work-execution.module";

describe("WorkExecutionModule public reconciliation port", () => {
  it("registers and exports the public port token", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      WorkExecutionModule,
    ) as Array<unknown>;
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      WorkExecutionModule,
    ) as Array<unknown>;

    expect(providers).toContainEqual(
      expect.objectContaining({ provide: RECONCILE_APPLIED_LIFECYCLE_FACT }),
    );
    expect(exports).toContain(RECONCILE_APPLIED_LIFECYCLE_FACT);
    expect(moduleManifest.publicPorts).toContain(
      "RECONCILE_APPLIED_LIFECYCLE_FACT",
    );
    expect(moduleManifest.depends).not.toContain("lifecycle-control");
  });
});
