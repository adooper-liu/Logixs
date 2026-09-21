import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ContainerStuffingCommandController } from "./container-stuffing-command.controller";

const identity = { tenantId: "tenant-a", actorId: "operator-a" };
const body = {
  expectedVersion: 0,
  allocationSetId: "22222222-2222-4222-8222-222222222222",
  allocationSetVersion: 3,
  containerNumber: "KOCU4960726",
  sealNumber: "25H1059249",
  packageCount: 524,
  grossWeight: "8319",
  netWeight: "8000",
  volume: "66.74",
  vgm: null,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  reasonCode: "stuffing_confirmed",
  idempotencyKey: "stuffing:container-1:v1",
};

describe("ContainerStuffingCommandController", () => {
  it("人工写入固定注入渠道、规范单位、来源系统和当前操作者", async () => {
    const replace = {
      execute: vi.fn().mockResolvedValue({ snapshotId: "snapshot-1" }),
    };
    const controller = new ContainerStuffingCommandController(replace as never);

    await controller.replace("container-1", body, { identity });

    expect(replace.execute).toHaveBeenCalledWith({
      ...body,
      tenantId: identity.tenantId,
      containerRecordId: "container-1",
      grossWeightUnit: "KGM",
      volumeUnit: "MTQ",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      actorId: identity.actorId,
    });
  });

  it("写接口声明服务端操作能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ContainerStuffingCommandController.prototype.replace,
      ),
    ).toEqual(["container.operate"]);
  });
});
