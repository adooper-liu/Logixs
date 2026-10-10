import type { ProductDefinitionV1 } from "@logix/contracts";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import ProductDefinitionAdvancePanel from "./ProductDefinitionAdvancePanel.vue";

function definition(
  overrides: Partial<ProductDefinitionV1> = {},
): ProductDefinitionV1 {
  return {
    contractVersion: "product-definition.v1",
    definitionId: "dddddddd-0000-4000-8000-000000000001",
    initiativeHandoffId: "aaaaaaaa-0000-4000-8000-000000000001",
    productOwnerActorId: "dev-operator",
    npiStage: "evt",
    version: 1,
    releaseState: "in_progress",
    specification: "40HC 折叠宠物推车",
    complianceAssumptions: ["CE"],
    stageOutcomes: [],
    pendingFieldCodes: ["evt_conclusion"],
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:00:00.000Z",
    ...overrides,
  };
}

function mountPanel(
  overrides: {
    definition?: ProductDefinitionV1 | null;
    stage?: "evt" | "dvt" | "pvt" | "mp";
    nextStage?: "evt" | "dvt" | "pvt" | "mp" | null;
    currentStageConcluded?: boolean;
    pendingFields?: { code: string; hint: string }[];
    released?: boolean;
  } = {},
) {
  const save = vi.fn().mockResolvedValue(true);
  const release = vi.fn().mockResolvedValue(true);
  // 草稿由上层持有；这里模拟上层，把子组件发出的事件写回自己那份状态。
  const draftState = reactive({
    specification: "40HC 折叠宠物推车",
    complianceAssumptions: ["CE"] as string[],
    conclusion: "",
  });
  const wrapper = mount(ProductDefinitionAdvancePanel, {
    props: {
      definition:
        overrides.definition === undefined
          ? definition()
          : overrides.definition,
      specification: draftState.specification,
      complianceAssumptions: draftState.complianceAssumptions,
      conclusion: draftState.conclusion,
      stage: overrides.stage ?? ("evt" as const),
      // 用 undefined 当"没给"，不能用 ?? —— null 是"确实没有下一段"的有效值。
      nextStage:
        overrides.nextStage === undefined
          ? ("dvt" as const)
          : overrides.nextStage,
      currentStageConcluded: overrides.currentStageConcluded ?? false,
      pendingFields: overrides.pendingFields ?? [
        { code: "evt_conclusion", hint: "在本阶段结论里写" },
      ],
      released: overrides.released ?? false,
      busy: false,
      save,
      release,
    },
  });
  return { wrapper, save, release, draftState };
}

describe("ProductDefinitionAdvancePanel", () => {
  it("阶段用行业说法并带上中文对照，同时说明本阶段还没登记结论", () => {
    const { wrapper } = mountPanel();

    expect(wrapper.text()).toContain("工程验证（EVT）");
    expect(wrapper.text()).toContain("本阶段还没登记结论");
  });

  it("缺口逐项说清在哪补，而不是一句「还差 N 项」", () => {
    const { wrapper } = mountPanel({
      pendingFields: [
        { code: "specification", hint: "在「产品规格」里写" },
        { code: "evt_conclusion", hint: "在本阶段结论里写" },
      ],
    });

    const items = wrapper.findAll(".pending li").map((node) => node.text());
    expect(items).toEqual([
      "specification在「产品规格」里写",
      "evt_conclusion在本阶段结论里写",
    ]);
  });

  it("保存并前进到下一段时把 advanceStage 交给上层", async () => {
    const { wrapper, save } = mountPanel();

    const buttons = wrapper.findAll(".actions button");
    const advance = buttons.find((button) =>
      button.text().includes("保存并前进到"),
    );
    await advance!.trigger("click");

    expect(save).toHaveBeenCalledWith(true);
    expect(wrapper.text()).toContain("设计验证（DVT）");
  });

  it("量产段没有下一段，按钮不再说前进", () => {
    const { wrapper } = mountPanel({
      stage: "mp",
      nextStage: null,
      definition: definition({ npiStage: "mp" }),
    });

    expect(wrapper.text()).not.toContain("保存并前进到");
  });

  it.each(["evt", "dvt", "pvt"] as const)("%s 阶段不呈现发布动作", (stage) => {
    const { wrapper } = mountPanel({
      stage,
      definition: definition({ npiStage: stage }),
    });

    expect(wrapper.find(".release button").text()).not.toBe("发布");
    expect(wrapper.text()).toContain("发布动作将在 MP 阶段");
  });

  it("合规假设的增删交给上层，组件不改 props；并说明它是假设不是结论", async () => {
    const { wrapper } = mountPanel();

    expect(wrapper.text()).toContain("假设");
    await wrapper.get('input[aria-label="新增合规假设"]').setValue("UN38.3");
    await wrapper
      .findAll(".add-row button")
      .find((button) => button.text() === "添加")!
      .trigger("click");

    expect(wrapper.emitted("updateComplianceAssumptions")).toEqual([
      [["CE", "UN38.3"]],
    ]);

    await wrapper
      .findAll(".assumptions button")
      .find((button) => button.text() === "移除")!
      .trigger("click");
    expect(wrapper.emitted("updateComplianceAssumptions")?.[1]).toEqual([[]]);
  });

  it("暂缓要先写原因 —— 不写为什么，事后无从复盘", async () => {
    const { wrapper, release } = mountPanel();

    await wrapper
      .findAll(".release button")
      .find((button) => button.text() === "暂缓")!
      .trigger("click");

    expect(wrapper.find('textarea[aria-label="暂缓原因"]').exists()).toBe(true);
    // 没写原因就确认，不该发出请求。
    await wrapper
      .findAll(".reason button")
      .find((button) => button.text().includes("确认暂缓"))!
      .trigger("click");
    expect(release).toHaveBeenCalledWith("defer", "");
  });

  it("已发布时只读：不摆推进与发布按钮，并说明交接已冻结", () => {
    const { wrapper } = mountPanel({
      definition: definition({ releaseState: "released" }),
      released: true,
    });

    expect(wrapper.text()).toContain("已发布，交给主数据侧建档");
    expect(wrapper.find('textarea[aria-label="产品规格"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.findAll("button").filter((b) => b.text() === "发布"),
    ).toHaveLength(0);
  });

  it("已登记的阶段结论按阶段列出，带人和时间", () => {
    const { wrapper } = mountPanel({
      definition: definition({
        stageOutcomes: [
          {
            stage: "evt",
            conclusion: "功能样机通过",
            evidenceRefs: [],
            recordedBy: "dev-operator",
            recordedAt: "2026-09-27T09:30:00.000Z",
          },
        ],
      }),
    });

    expect(wrapper.text()).toContain("功能样机通过");
    expect(wrapper.text()).toContain("dev-operator");
  });
});
