import type { ProductInitiativeNpiQueueEntryV1 } from "@logix/contracts";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductNpiWorkbench from "./ProductNpiWorkbench.vue";

const listProductInitiativeNpiQueue = vi.fn();
const claimProductInitiative = vi.fn();

vi.mock("../api/marketSignals", () => ({
  listProductInitiativeNpiQueue: (...args: unknown[]) =>
    listProductInitiativeNpiQueue(...args),
  claimProductInitiative: (...args: unknown[]) =>
    claimProductInitiative(...args),
}));

describe("ProductNpiWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProductInitiativeNpiQueue.mockResolvedValue(page([entry({})]));
    claimProductInitiative.mockResolvedValue(entry({ claimed: true }));
  });

  it("首屏把待办按等谁动分组，并说明这一票还没有人接", async () => {
    listProductInitiativeNpiQueue.mockResolvedValue(
      page([
        entry({ handoffId: "h-waiting", objective: "宠物出行品类" }),
        entry({
          handoffId: "h-mine",
          objective: "户外电源品类",
          claimedBy: "dev-operator",
        }),
        entry({
          handoffId: "h-others",
          objective: "厨房小电品类",
          claimedBy: "someone-else",
        }),
      ]),
    );
    const wrapper = await mountWorkbench("h-waiting");

    expect(wrapper.text()).toContain("等我接手");
    expect(wrapper.text()).toContain("我负责的");
    expect(wrapper.text()).toContain("已在他人手上");
    expect(wrapper.text()).toContain("还没有人接 —— 接了就是你");
  });

  it("选中一票后展示立项快照，并写明这是只读的立项结论", async () => {
    const wrapper = await mountWorkbench("h-1");

    expect(wrapper.text()).toContain("宠物出行品类");
    expect(wrapper.text()).toContain("目标用户与市场");
    expect(wrapper.text()).toContain("本岗位只读");
  });

  it("领取按服务端身份落负责人，并给出回执", async () => {
    const wrapper = await mountWorkbench("h-1");

    await wrapper.find(".npi-action button").trigger("click");
    await flushPromises();

    expect(claimProductInitiative).toHaveBeenCalledWith("h-1", {
      contractVersion: "product-initiative-claim.v1",
      expectedClaimVersion: 0,
      idempotencyKey: expect.stringContaining("h-1"),
    });
    expect(wrapper.text()).toContain("已接到你名下");
  });

  it("已被他人领走时不摆领取按钮，并说明不会重复领取", async () => {
    listProductInitiativeNpiQueue.mockResolvedValue(
      page([entry({ handoffId: "h-others", claimedBy: "someone-else" })]),
    );
    const wrapper = await mountWorkbench("h-others");

    expect(wrapper.find(".npi-action button").exists()).toBe(false);
    expect(wrapper.text()).toContain("已在他人手上");
  });

  it("打开工作台默认落在等我接手的那一条，不必先点一下", async () => {
    listProductInitiativeNpiQueue.mockResolvedValue(
      page([
        entry({ handoffId: "h-others", claimedBy: "someone-else" }),
        entry({ handoffId: "h-waiting", objective: "宠物出行品类" }),
      ]),
    );
    const wrapper = await mountWorkbench();

    // 落点是"等我接手"的第一条，而不是列表第一条（那条已在他人手上）。
    expect(wrapper.text()).toContain("还没有人接 —— 接了就是你");
    expect(wrapper.text()).toContain("宠物出行品类");
  });

  it("加载失败时报错并给重试，而不是装作没有待办", async () => {
    listProductInitiativeNpiQueue.mockRejectedValue(
      new Error("暂时无法加载产品侧待办"),
    );
    const wrapper = await mountWorkbench();

    expect(wrapper.find('[role="alert"]').text()).toContain(
      "暂时无法加载产品侧待办",
    );
    expect(wrapper.text()).toContain("重新加载");
  });

  it("领取失败时报错，不显示成功回执", async () => {
    claimProductInitiative.mockRejectedValue(
      new Error("PRODUCT_INITIATIVE_ALREADY_CLAIMED"),
    );
    const wrapper = await mountWorkbench("h-1");

    await wrapper.find(".npi-action button").trigger("click");
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain(
      "PRODUCT_INITIATIVE_ALREADY_CLAIMED",
    );
    expect(wrapper.text()).not.toContain("已接到你名下");
  });
});

async function mountWorkbench(selectedId?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/workspaces/product-npi",
        component: ProductNpiWorkbench,
      },
    ],
  });
  await router.push(
    selectedId
      ? { path: "/workspaces/product-npi", query: { handoffId: selectedId } }
      : "/workspaces/product-npi",
  );
  await router.isReady();
  const wrapper = mount(ProductNpiWorkbench, {
    global: {
      plugins: [router],
      // PageHeader 依赖主题 provider；这里只关心本页行为，用桩替掉。
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

function page(items: ProductInitiativeNpiQueueEntryV1[]) {
  return {
    contractVersion: "product-initiative-npi-queue.v1",
    items,
    pageSize: 200,
    nextCursor: null,
  };
}

function entry(options: {
  handoffId?: string;
  objective?: string;
  claimed?: boolean;
  claimedBy?: string;
}): ProductInitiativeNpiQueueEntryV1 {
  const handoffId = options.handoffId ?? "h-1";
  return {
    handoff: {
      contractVersion: "product_initiative_handoff.v1",
      handoffId,
      version: 1,
      initiativeId: "11111111-1111-4111-8111-111111111111",
      signalId: "22222222-2222-4222-8222-222222222222",
      marketCode: "CA",
      userProblem: "宠物出行用品在加拿大复购低",
      objective: options.objective ?? "宠物出行品类",
      responsibleActorId: "selector-1",
      reviewPoints: [
        {
          code: "target_user_and_market",
          evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
          conclusion: "加拿大养宠家庭",
        },
      ],
      evidenceRefs: [],
      createdAt: "2026-09-27T10:00:00.000Z",
      idempotencyKey: `handoff-${handoffId}`,
    },
    claim: options.claimed
      ? {
          claimId: "44444444-4444-4444-8444-444444444444",
          handoffId,
          claimVersion: 1,
          productOwnerActorId: "dev-operator",
          claimedAt: "2026-09-27T11:00:00.000Z",
        }
      : options.claimedBy
        ? {
            claimId: "55555555-5555-4555-8555-555555555555",
            handoffId,
            claimVersion: 1,
            productOwnerActorId: options.claimedBy,
            claimedAt: "2026-09-27T11:00:00.000Z",
          }
        : null,
  };
}
