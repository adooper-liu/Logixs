import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImportBatchDetail from "./ImportBatchDetail.vue";

const getImportBatch = vi.fn();
const getReconciliation = vi.fn();
const uploadImportBatch = vi.fn();

vi.mock("../api/importBatches", () => ({
  confirmMappings: vi.fn(),
  executeImport: vi.fn(),
  getImportBatch: (...args: unknown[]) => getImportBatch(...args),
  getReconciliation: (...args: unknown[]) => getReconciliation(...args),
  runPrecheck: vi.fn(),
  uploadImportBatch: (...args: unknown[]) => uploadImportBatch(...args),
}));

function detail(id: string) {
  return {
    batch: {
      id,
      fileName: `${id}.csv`,
      sourceFileStatus: id === "old-batch" ? "not_retained" : "retained",
      sourceSizeBytes: id === "old-batch" ? null : 2048,
      parserVersion: id === "old-batch" ? "legacy-v1" : "tabular-v2",
      replacesBatchId: id === "old-batch" ? null : "old-batch",
      status: "parsed",
      rowCount: 1,
      columnCount: 3,
      mappingSuggestions: [],
      confirmedQuantityUnit: null,
      createdAt: "2026-09-16T00:00:00.000Z",
    },
    columns: ["备货单号", "产品货号", "出运数量"],
    rows: [
      {
        rowNo: 1,
        values: { 备货单号: "SO-1", 产品货号: "SKU-1", 出运数量: "1" },
      },
    ],
    effectiveMappings: [],
    fieldCatalog: { version: "1.2.0", fields: [], quantityUnits: [] },
  };
}

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/import/:batchId",
        component: ImportBatchDetail,
      },
    ],
  });
  await router.push("/import/old-batch");
  await router.isReady();
  const wrapper = mount(ImportBatchDetail, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: { template: "<header>导入批次</header>" },
        ImportMappingEditor: true,
      },
    },
  });
  await flushPromises();
  return { router, wrapper };
}

describe("ImportBatchDetail replacement upload", () => {
  beforeEach(() => {
    getImportBatch.mockReset();
    getReconciliation.mockReset();
    uploadImportBatch.mockReset();
    getImportBatch.mockImplementation(async (id: string) => detail(id));
  });

  it("替代上传成功后切换并重新加载新批次", async () => {
    uploadImportBatch.mockResolvedValue(detail("new-batch").batch);
    const { router, wrapper } = await mountPage();
    const file = new File(["order-number\nSO-1"], "split.csv");
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");
    await flushPromises();

    expect(uploadImportBatch).toHaveBeenCalledWith(file, "old-batch");
    expect(router.currentRoute.value.params.batchId).toBe("new-batch");
    expect(getImportBatch).toHaveBeenCalledWith("new-batch");
    expect(wrapper.text()).toContain("new-batch.csv");
    expect(wrapper.text()).toContain("tabular-v2");
    expect(wrapper.text()).toContain("已留存 · 2.0 KB");
  });

  it("替代上传失败时保留旧批次并显示错误", async () => {
    uploadImportBatch.mockRejectedValue(new Error("上传失败（400）：版式错误"));
    const { router, wrapper } = await mountPage();
    const file = new File(["bad"], "mixed.csv");
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");
    await flushPromises();

    expect(router.currentRoute.value.params.batchId).toBe("old-batch");
    expect(wrapper.text()).toContain("old-batch.csv");
    expect(wrapper.text()).toContain("历史批次未留存");
    expect(wrapper.text()).toContain("版式错误");
  });
});
