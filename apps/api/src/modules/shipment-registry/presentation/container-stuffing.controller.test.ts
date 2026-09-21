import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ContainerStuffingController } from "./container-stuffing.controller";

const identity = { tenantId: "tenant-a" };

describe("ContainerStuffingController", () => {
  it("按当前租户读取装箱快照", async () => {
    const getSnapshot = {
      execute: vi.fn().mockResolvedValue({ snapshotId: "snapshot-1" }),
    };
    const controller = new ContainerStuffingController(getSnapshot as never);

    await controller.getCurrent("container-1", { identity });

    expect(getSnapshot.execute).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      containerRecordId: "container-1",
    });
  });

  it("读取接口声明服务端能力要求", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ContainerStuffingController.prototype.getCurrent,
      ),
    ).toEqual(["container.read"]);
  });
});
