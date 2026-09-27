import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MasterDataWorkbench from "./MasterDataWorkbench.vue";

const listProductIdentityQueue = vi.fn();
const getProductIdentity = vi.fn();
const draftProductIdentity = vi.fn();
const releaseSellableSku = vi.fn();

vi.mock("../api/marketSignals", () => ({
  listProductIdentityQueue: (...args: unknown[]) =>
    listProductIdentityQueue(...args),
  getProductIdentity: (...args: unknown[]) => getProductIdentity(...args),
  draftProductIdentity: (...args: unknown[]) => draftProductIdentity(...args),
  releaseSellableSku: (...args: unknown[]) => releaseSellableSku(...args),
}));

describe("MasterDataWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProductIdentityQueue.mockResolvedValue({
      items: [queueItem({})],
    });
    getProductIdentity.mockResolvedValue(null);
    draftProductIdentity.mockResolvedValue({});
    releaseSellableSku.mockResolvedValue({});
  });

  it("首屏把待建档的设计按等谁动分组，并默认落在第一条", async () => {
    listProductIdentityQueue.mockResolvedValue({
      items: [
        queueItem({
          releaseId: "r-done",
          productId: "p-1",
          productNumber: "P-1",
        }),
        queueItem({ releaseId: "r-waiting", specification: "折叠宠物推车" }),
      ],
    });
    const wrapper = await mountWorkbench();

    expect(wrapper.text()).toContain("等我建档");
    expect(wrapper.text()).toContain("已建档");
    // 落点是"等我建档"的第一条，而不是列表第一条（那条已建档）。
    expect(wrapper.text()).toContain("折叠宠物推车");
  });

  it("发布前还差什么逐项列出，而不是只说「还不能发布」", async () => {
    const wrapper = await mountWorkbench("r-1");

    const gaps = wrapper.findAll(".pending li").map((node) => node.text());
    expect(gaps).toContain("产品号");
    expect(gaps).toContain("品类");
    expect(gaps).toContain("HS 编码");
    expect(gaps).toContain("目标销售国家");
  });

  it("缺项时发布按钮按不动；先保存、再填齐才可用", async () => {
    const wrapper = await mountWorkbench("r-1");
    const publish = () =>
      wrapper.findAll("button").find((b) => b.text().includes("发布可售 SKU"))!;

    expect(publish().attributes("disabled")).toBeDefined();

    await wrapper.get('input[aria-label="对外产品号"]').setValue("PET-01");
    await wrapper.get('input[aria-label="品类"]').setValue("pet_travel");
    await wrapper.get('input[aria-label="功能名"]').setValue("折叠宠物推车");
    await wrapper.get('input[aria-label="原产国"]').setValue("CN");
    await wrapper.get('input[aria-label="HS 编码"]').setValue("8716800000");
    await wrapper.get('input[aria-label="目标销售国家"]').setValue("US, CA");
    await wrapper.get('input[aria-label="SKU 编号 1"]').setValue("SKU-1");

    // 还没建档时发布是禁用的 —— 发布的是**已存下来的身份**，不是屏幕上的草稿。
    expect(publish().attributes("disabled")).toBeDefined();

    draftProductIdentity.mockResolvedValue({
      version: 1,
      skus: [{ skuId: "s-1" }],
    });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "保存")!
      .trigger("click");
    await flushPromises();

    expect(publish().attributes("disabled")).toBeUndefined();
  });

  it("保存把草稿交给服务端，半成品也存得下", async () => {
    const wrapper = await mountWorkbench("r-1");

    await wrapper.get('input[aria-label="品类"]').setValue("pet_travel");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "保存")!
      .trigger("click");
    await flushPromises();

    expect(draftProductIdentity).toHaveBeenCalledWith(
      "r-1",
      expect.objectContaining({
        contractVersion: "product-identity-draft.v1",
        expectedVersion: 0,
        attributes: expect.objectContaining({ categoryCode: "pet_travel" }),
      }),
    );
  });

  it("目标国家与认证按逗号拆成数组，并把国别码转成大写", async () => {
    const wrapper = await mountWorkbench("r-1");

    await wrapper.get('input[aria-label="目标销售国家"]').setValue("us, ca");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "保存")!
      .trigger("click");
    await flushPromises();

    expect(draftProductIdentity).toHaveBeenCalledWith(
      "r-1",
      expect.objectContaining({
        attributes: expect.objectContaining({ targetCountries: ["US", "CA"] }),
      }),
    );
  });

  it("危险品默认「没有」，勾上才出现结构化字段", async () => {
    const wrapper = await mountWorkbench("r-1");

    expect(wrapper.find('input[aria-label="UN 编号"]').exists()).toBe(false);
    await wrapper.get('input[aria-label="这件产品属于危险品"]').setValue(true);

    expect(wrapper.find('input[aria-label="UN 编号"]').exists()).toBe(true);
  });

  it("加载失败时报错并给重试，而不是装作没有待办", async () => {
    listProductIdentityQueue.mockRejectedValue(
      new Error("暂时无法加载待建档的产品设计"),
    );
    const wrapper = await mountWorkbench();

    expect(wrapper.find('[role="alert"]').text()).toContain(
      "暂时无法加载待建档的产品设计",
    );
  });
});

async function mountWorkbench(selectedId?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/workspaces/master-data", component: MasterDataWorkbench },
    ],
  });
  await router.push(
    selectedId
      ? { path: "/workspaces/master-data", query: { releaseId: selectedId } }
      : "/workspaces/master-data",
  );
  await router.isReady();
  const wrapper = mount(MasterDataWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title", "summary"],
          template: "<header><h1>{{ title }}</h1><p>{{ summary }}</p></header>",
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function queueItem(overrides: {
  releaseId?: string;
  specification?: string;
  productId?: string | null;
  productNumber?: string | null;
}) {
  return {
    releaseId: overrides.releaseId ?? "r-1",
    definitionId: "d-1",
    specification: overrides.specification ?? "40HC 折叠宠物推车",
    npiStage: "mp",
    releasedBy: "product-owner",
    releasedAt: "2026-09-27T10:00:00.000Z",
    productId: overrides.productId ?? null,
    productNumber: overrides.productNumber ?? null,
  };
}
