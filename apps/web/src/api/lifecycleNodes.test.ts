import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listLifecycleNodes,
  listLifecycleNodesByContainers,
} from "./lifecycleNodes";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listLifecycleNodes", () => {
  it("按货柜列节点并带开发期身份", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        flow: null,
        nodes: [],
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listLifecycleNodes("c1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/c1/lifecycle-nodes",
      {
        headers: {
          "X-Tenant-Id": "dev-tenant",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });

  it("404 映射为 RESOURCE_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(listLifecycleNodes("missing")).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
  });
});

describe("listLifecycleNodesByContainers", () => {
  it("按货柜批量列节点并带开发期身份", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listLifecycleNodesByContainers(["c1", "c2"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lifecycle-nodes?containerIds=c1%2Cc2",
      {
        headers: {
          "X-Tenant-Id": "dev-tenant",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });
});
