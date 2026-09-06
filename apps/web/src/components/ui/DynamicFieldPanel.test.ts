import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DynamicFieldPanel from "./DynamicFieldPanel.vue";
import {
  createDisplayFieldSet,
  type DisplayFieldSchema,
} from "./displayFieldContract";

const schema: DisplayFieldSchema = {
  schemaId: "test-container-summary",
  schemaVersion: 1,
  groups: [{ code: "summary", label: "货柜摘要", order: 1 }],
  fields: [
    {
      code: "containerNumber",
      label: "柜号",
      groupCode: "summary",
      type: "identifier",
      order: 10,
      description: "货柜流转记录当前绑定的展示柜号。",
    },
    {
      code: "estimatedFee",
      label: "预计费用",
      groupCode: "summary",
      type: "currency",
      order: 20,
    },
    {
      code: "hasHold",
      label: "是否扣留",
      groupCode: "summary",
      type: "boolean",
      order: 30,
    },
    {
      code: "sealNumber",
      label: "封条号",
      groupCode: "summary",
      type: "identifier",
      order: 40,
      priority: "secondary",
      emptyLabel: "待补",
    },
  ],
};

describe("DynamicFieldPanel", () => {
  it("renders declared fields in schema order with type-aware formatting", () => {
    const wrapper = mount(DynamicFieldPanel, {
      props: {
        fieldSet: {
          schema,
          values: {
            hasHold: true,
            estimatedFee: { amount: "1234.50", currency: "USD" },
            containerNumber: "TCLU-2387642",
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text.indexOf("柜号")).toBeLessThan(text.indexOf("预计费用"));
    expect(text).toContain("TCLU-2387642");
    expect(text).toContain("USD 1,234.50");
    expect(text).toContain("是否扣留是");
    expect(text).not.toContain("货柜流转记录当前绑定的展示柜号。");
    expect(wrapper.get('[aria-label="查看柜号说明"]')).toBeTruthy();
    expect(wrapper.get("summary").text()).toBe("更多字段 1");
    expect(text).toContain("封条号待补");
  });

  it("only copies schema-approved values from a source object", () => {
    const fieldSet = createDisplayFieldSet(schema, {
      containerNumber: "TCLU-2387642",
      internalSecret: "must-not-render",
    });
    const wrapper = mount(DynamicFieldPanel, { props: { fieldSet } });

    expect(Object.keys(fieldSet.values)).toEqual([
      "containerNumber",
      "estimatedFee",
      "hasHold",
      "sealNumber",
    ]);
    expect(wrapper.text()).not.toContain("must-not-render");
  });

  it("fails visibly when an untrusted schema contains an unsupported type", () => {
    const invalidSchema = {
      ...schema,
      fields: [{ ...schema.fields[0], type: "html" }],
    } as unknown as DisplayFieldSchema;
    const wrapper = mount(DynamicFieldPanel, {
      props: {
        fieldSet: {
          schema: invalidSchema,
          values: { containerNumber: "<img src=x onerror=alert(1)>" },
        },
      },
    });

    expect(wrapper.get('[role="alert"]').text()).toContain("字段类型不支持");
    expect(wrapper.find("img").exists()).toBe(false);
  });

  it("marks impossible dates and invalid time zones as format errors", () => {
    const temporalSchema: DisplayFieldSchema = {
      schemaId: "test-temporal-fields",
      schemaVersion: 1,
      groups: [{ code: "schedule", label: "时间", order: 1 }],
      fields: [
        {
          code: "plannedDate",
          label: "计划日期",
          groupCode: "schedule",
          type: "date",
          order: 10,
        },
        {
          code: "occurredAt",
          label: "发生时间",
          groupCode: "schedule",
          type: "datetime",
          order: 20,
          timeZone: "Invalid/TimeZone",
        },
        {
          code: "receivedAt",
          label: "接收时间",
          groupCode: "schedule",
          type: "datetime",
          order: 30,
        },
      ],
    };
    const wrapper = mount(DynamicFieldPanel, {
      props: {
        fieldSet: {
          schema: temporalSchema,
          values: {
            plannedDate: "2026-02-30",
            occurredAt: "2026-09-06T08:00:00Z",
            receivedAt: "2026-09-06T08:00:00",
          },
        },
      },
    });

    expect(wrapper.findAll("dd.invalid")).toHaveLength(3);
    expect(wrapper.text()).toContain("计划日期格式错误");
    expect(wrapper.text()).toContain("发生时间格式错误");
    expect(wrapper.text()).toContain("接收时间格式错误");
  });

  it("renders a stable empty state for an approved schema without fields", () => {
    const wrapper = mount(DynamicFieldPanel, {
      props: {
        fieldSet: {
          schema: {
            schemaId: "empty-container-projection",
            schemaVersion: 1,
            groups: [],
            fields: [],
          },
          values: {},
        },
      },
    });

    expect(wrapper.get(".empty-fields").text()).toBe("暂无可展示字段");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("rejects duplicate field codes instead of rendering ambiguous values", () => {
    const duplicateSchema: DisplayFieldSchema = {
      ...schema,
      fields: [schema.fields[0], { ...schema.fields[0], order: 20 }],
    };
    const wrapper = mount(DynamicFieldPanel, {
      props: {
        fieldSet: {
          schema: duplicateSchema,
          values: { containerNumber: "TCLU-2387642" },
        },
      },
    });

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "字段码重复: containerNumber",
    );
    expect(wrapper.find("dd").exists()).toBe(false);
  });

  it("fails visibly when runtime JSON does not match the typed schema shape", () => {
    const wrapper = mount(DynamicFieldPanel, {
      props: {
        fieldSet: {
          schema: {
            schemaId: "broken-projection",
            schemaVersion: 1,
            groups: null,
            fields: [],
          },
          values: {},
        } as unknown as ReturnType<typeof createDisplayFieldSet>,
      },
    });

    expect(wrapper.get('[role="alert"]').text()).toContain("字段配置结构无效");
  });
});
