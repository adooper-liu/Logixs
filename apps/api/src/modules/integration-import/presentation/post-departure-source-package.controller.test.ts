import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { AcceptPostDepartureSourcePackageService } from "../application/accept-post-departure-source-package.service";
import type { BuildPostDepartureStandardTemplateService } from "../application/build-post-departure-standard-template.service";
import { PostDepartureSourcePackageController } from "./post-departure-source-package.controller";

describe("PostDepartureSourcePackageController", () => {
  it("requires import execution capability for batch acceptance", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        PostDepartureSourcePackageController.prototype.acceptAll,
      ),
    ).toEqual(["import.execute"]);
  });

  it("passes the authenticated tenant and actor to batch acceptance", async () => {
    const acceptPackage = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const controller = new PostDepartureSourcePackageController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      acceptPackage as unknown as AcceptPostDepartureSourcePackageService,
      {} as never,
    );
    const packageId = "a".repeat(64);
    const body = {
      contractVersion: "post-departure-source-package-accept.v1" as const,
      packageId,
      sources: [
        {
          kind: "container" as const,
          batchId: "11111111-1111-4111-8111-111111111111",
        },
      ] as [
        {
          kind: "container";
          batchId: string;
        },
      ],
      idempotencyKey: "package-accept-1",
    };

    await controller.acceptAll(packageId, body, {
      identity: { tenantId: "tenant-1", actorId: "actor-1" },
    });

    expect(acceptPackage.execute).toHaveBeenCalledWith(packageId, body, {
      tenantId: "tenant-1",
      actorId: "actor-1",
    });
  });

  it("downloads the standard template built from the active reference catalog", async () => {
    const template = Buffer.from("xlsx-template");
    const buildStandardTemplate = {
      execute: vi.fn().mockResolvedValue(template),
    };
    const controller = new PostDepartureSourcePackageController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      buildStandardTemplate as unknown as BuildPostDepartureStandardTemplateService,
    );

    const result = await controller.standardTemplate();
    const chunks: Buffer[] = [];
    for await (const chunk of result.getStream()) {
      chunks.push(Buffer.from(chunk));
    }

    expect(buildStandardTemplate.execute).toHaveBeenCalledOnce();
    expect(Buffer.concat(chunks)).toEqual(template);
  });
});
