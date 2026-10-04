import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { GetWorkbenchNetworkVolumeService } from "./get-workbench-network-volume.service";

describe("get workbench network volume", () => {
  it("refuses an empty tenant before counting", async () => {
    const count = vi.fn();
    const service = new GetWorkbenchNetworkVolumeService({ count } as never);

    await expect(service.execute({ tenantId: "" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(count).not.toHaveBeenCalled();
  });
});
