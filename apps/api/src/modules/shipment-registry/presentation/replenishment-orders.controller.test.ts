import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ReplenishmentOrdersController } from "./replenishment-orders.controller";

describe("ReplenishmentOrdersController", () => {
  it("把租户和分页参数传入应用服务", async () => {
    const list = {
      execute: vi.fn().mockResolvedValue({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 20 },
        asOf: new Date("2026-09-21T12:00:00.000Z"),
        projectionVersion: 1,
      }),
    };
    const controller = new ReplenishmentOrdersController(list as never);

    await expect(
      controller.list({ identity: { tenantId: "tenant-a" } }, "20", "cursor-1"),
    ).resolves.toMatchObject({
      asOf: "2026-09-21T12:00:00.000Z",
      projectionVersion: 1,
    });
    expect(list.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      pageSize: "20",
      cursor: "cursor-1",
    });
  });

  it("声明备货单读取所需的服务端能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ReplenishmentOrdersController.prototype.list,
      ),
    ).toEqual(["container.read"]);
  });
});
