import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ContainerDispatchController } from "./container-dispatch.controller";

describe("ContainerDispatchController", () => {
  it("reads the current dispatch snapshot inside the tenant scope", async () => {
    const getSnapshot = { execute: vi.fn().mockResolvedValue(null) };
    const controller = new ContainerDispatchController(getSnapshot as never);
    await controller.getCurrent("container-1", {
      identity: { tenantId: "tenant-a" },
    });
    expect(getSnapshot.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      containerRecordId: "container-1",
    });
  });

  it("declares the server-side read capability", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ContainerDispatchController.prototype.getCurrent,
      ),
    ).toEqual(["container.read"]);
  });
});
