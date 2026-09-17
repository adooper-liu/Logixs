import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadImportBatch } from "./importBatches";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadImportBatch", () => {
  it("中文文件名不会进入 Idempotency-Key 请求头", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "batch-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await uploadImportBatch(
      new File(["container-number\nMSCU1234567"], "货柜导入.csv", {
        type: "text/csv",
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = request.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^import:sha256:[a-f0-9]{64}$/);
  });

  it("按文件内容而不是文件名和大小识别重复上传", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "batch-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await uploadImportBatch(new File(["same"], "中文.csv"));
    await uploadImportBatch(new File(["same"], "renamed.csv"));
    await uploadImportBatch(new File(["diff"], "renamed.csv"));

    const keys = fetchMock.mock.calls.map(
      (call) =>
        ((call[1] as RequestInit).headers as Record<string, string>)[
          "Idempotency-Key"
        ],
    );
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("替代上传把旧批次 ID 放在 multipart 正文而不是请求头", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "batch-2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await uploadImportBatch(new File(["same"], "split.csv"), "batch-1");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = request.headers as Record<string, string>;
    const body = request.body as FormData;
    expect(headers["Idempotency-Key"]).not.toContain("batch-1");
    expect(body.get("replacesBatchId")).toBe("batch-1");
  });
});
