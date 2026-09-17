import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ImportFieldCatalog } from "../../api/importBatches";
import ImportMappingEditor from "./ImportMappingEditor.vue";

const fieldCatalog: ImportFieldCatalog = {
  version: "1.2.0",
  fields: [
    {
      code: "orderNumber",
      label: "备货单号",
      scope: "header" as const,
      required: true,
    },
    {
      code: "productNumber",
      label: "产品货号",
      scope: "line" as const,
      required: true,
    },
    {
      code: "shippedQuantity",
      label: "出运数量",
      scope: "line" as const,
      required: true,
    },
    {
      code: "quantityUnit",
      label: "出运数量单位",
      scope: "line" as const,
      required: true,
    },
  ],
  quantityUnits: [
    { code: "piece", label: "件" },
    { code: "carton", label: "箱" },
  ],
};

function mountEditor() {
  return mount(ImportMappingEditor, {
    props: {
      columns: ["备货单号", "产品", "数量"],
      suggestions: [
        { column: "备货单号", fieldCode: "orderNumber", confidence: 0.9 },
        { column: "产品", fieldCode: null, confidence: 0 },
        { column: "数量", fieldCode: "shippedQuantity", confidence: 0.9 },
      ],
      effectiveMappings: [],
      fieldCatalog,
      confirmedQuantityUnit: null,
    },
  });
}

describe("ImportMappingEditor", () => {
  it("数量单位未显式确认时禁止提交", () => {
    const wrapper = mountEditor();

    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });

  it("提交人工修正后的映射和显式数量单位", async () => {
    const wrapper = mountEditor();
    const columnSelects = wrapper.findAll(".mapping-row select");

    await columnSelects[1].setValue("productNumber");
    await wrapper.get('[data-testid="quantity-unit"]').setValue("piece");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("confirm")?.[0]).toEqual([
      {
        reviews: [
          { column: "备货单号", fieldCode: "orderNumber" },
          { column: "产品", fieldCode: "productNumber" },
          { column: "数量", fieldCode: "shippedQuantity" },
        ],
        quantityUnit: "piece",
      },
    ]);
  });

  it("映射来源单位列后清除整批单位并允许提交", async () => {
    const wrapper = mountEditor();
    const columnSelects = wrapper.findAll(".mapping-row select");

    await wrapper.get('[data-testid="quantity-unit"]').setValue("carton");
    await columnSelects[1].setValue("quantityUnit");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("confirm")?.[0]?.[0]).toMatchObject({
      quantityUnit: null,
      reviews: expect.arrayContaining([
        { column: "产品", fieldCode: "quantityUnit" },
      ]),
    });
  });

  it("同一目标字段被多列建议时不预选任何冲突列", () => {
    const wrapper = mount(ImportMappingEditor, {
      props: {
        columns: ["备货单状态", "备货单号", "数量"],
        suggestions: [
          { column: "备货单状态", fieldCode: "orderNumber", confidence: 0.9 },
          { column: "备货单号", fieldCode: "orderNumber", confidence: 0.9 },
          { column: "数量", fieldCode: "shippedQuantity", confidence: 0.9 },
        ],
        effectiveMappings: [],
        fieldCatalog,
        confirmedQuantityUnit: null,
      },
    });

    expect(
      (wrapper.get('[data-column="备货单状态"]').element as HTMLSelectElement)
        .value,
    ).toBe("");
    expect(
      (wrapper.get('[data-column="备货单号"]').element as HTMLSelectElement)
        .value,
    ).toBe("");
    expect(
      (wrapper.get('[data-column="数量"]').element as HTMLSelectElement).value,
    ).toBe("shippedQuantity");
  });
});
