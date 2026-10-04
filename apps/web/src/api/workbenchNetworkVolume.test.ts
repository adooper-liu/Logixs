import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./httpClient";
import { getWorkbenchNetworkVolume } from "./workbenchNetworkVolume";

vi.mock("./httpClient", () => ({
  requestJson: vi.fn(),
}));

describe("workbench network volume client", () => {
  beforeEach(() => {
    vi.mocked(requestJson).mockReset();
  });

  it("reads the volume projection from the hub endpoint", async () => {
    vi.mocked(requestJson).mockResolvedValue({
      contractVersion: "workbench-network-volume.v1",
    });

    await getWorkbenchNetworkVolume();

    expect(requestJson).toHaveBeenCalledWith("/api/workbench-network/volume", {
      fallback: "业务量暂时读不出来",
    });
  });
});
