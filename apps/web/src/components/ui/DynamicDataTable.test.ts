import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DynamicDataTable from "./DynamicDataTable.vue";
import type { DataTableProjection } from "./dataTableContract";

const createProjection = (): DataTableProjection => ({
  schema: {
    schemaId: "test.container-list",
    schemaVersion: 1,
    label: "测试货柜表",
    searchPlaceholder: "搜索测试货柜",
    rowLabelColumnCode: "containerNumber",
    quickFilters: [
      { code: "all", label: "全部", matchAll: true },
      { code: "risk", label: "风险" },
    ],
    columns: [
      {
        code: "taskStatus",
        label: "任务状态",
        kind: "status",
        order: 30,
        width: 150,
      },
      {
        code: "containerNumber",
        label: "货柜",
        kind: "entity",
        order: 10,
        width: 220,
        searchable: true,
        sortable: true,
        pinned: "left",
        rowAction: "open",
      },
      {
        code: "containerStatus",
        label: "货柜状态",
        kind: "status",
        order: 20,
        width: 140,
      },
      {
        code: "syncStatus",
        label: "同步状态",
        kind: "status",
        order: 40,
        width: 160,
      },
      {
        code: "reference",
        label: "参考号",
        kind: "text",
        order: 50,
        width: 110,
        searchable: true,
        hideable: true,
      },
      {
        code: "open",
        label: "查看",
        kind: "action",
        order: 60,
        width: 52,
        pinned: "right",
        rowAction: "open",
      },
    ],
  },
  rows: [
    {
      rowId: "row-b",
      tone: "risk",
      filterKeys: ["risk"],
      values: {
        containerNumber: {
          primary: "ZZZU-0000002",
          supportingValues: ["ORDER-B", "BILL-B"],
          context: "目的港到港",
        },
        containerStatus: {
          code: "at_port",
          label: "已到港",
          tone: "warn",
          changedAt: "09-10 08:00",
        },
        taskStatus: {
          code: "blocked",
          label: "任务阻塞",
          tone: "risk",
          changedAt: "09-10 08:10",
        },
        syncStatus: {
          code: "received",
          label: "请求已接收",
          tone: "info",
          changedAt: "09-10 08:11",
        },
        reference: "REF-B",
        secretValue: "不得显示",
      },
    },
    {
      rowId: "row-a",
      tone: "ok",
      values: {
        containerNumber: {
          primary: "AAAU-0000001",
          supportingValues: ["ORDER-A", "BILL-A"],
          context: "在途",
        },
        containerStatus: {
          code: "released",
          label: "已放行",
          tone: "ok",
        },
        taskStatus: {
          code: "completed",
          label: "任务完成",
          tone: "ok",
        },
        syncStatus: {
          code: "committed",
          label: "业务事实已落账",
          tone: "ok",
        },
        reference: "REF-A",
      },
    },
  ],
  pageInfo: {
    total: 2,
    offset: 0,
    limit: 25,
    hasPrevious: false,
    hasNext: false,
  },
});

describe("DynamicDataTable", () => {
  it("uses schema order and renderers without exposing undeclared row values", () => {
    const wrapper = mount(DynamicDataTable, {
      props: { projection: createProjection(), filter: "all" },
    });

    expect(wrapper.findAll("th").map((cell) => cell.text())).toEqual([
      "货柜",
      "货柜状态",
      "任务状态",
      "同步状态",
      "参考号",
      "查看",
    ]);
    expect(wrapper.text()).toContain("已到港09-10 08:00");
    expect(wrapper.text()).toContain("任务阻塞09-10 08:10");
    expect(wrapper.text()).toContain("请求已接收09-10 08:11");
    expect(wrapper.text()).not.toContain("时间待记录");
    expect(wrapper.get(".entity-action").text()).toContain(
      "ZZZU-0000002ORDER-B · BILL-B目的港到港",
    );
    expect(wrapper.text()).not.toContain("不得显示");
  });

  it("supports schema-driven search, quick filters, sorting, and column visibility", async () => {
    const wrapper = mount(DynamicDataTable, {
      props: { projection: createProjection(), filter: "all" },
    });

    await wrapper.get('input[type="search"]').setValue("REF-A");
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.text()).toContain("AAAU-0000001");
    expect(wrapper.text()).not.toContain("ZZZU-0000002");

    await wrapper.get('input[type="search"]').setValue("BILL-B");
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.text()).toContain("ZZZU-0000002");

    await wrapper.get('input[type="search"]').setValue("");
    await wrapper
      .get('.quick-filters button[aria-pressed="false"]')
      .trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.text()).toContain("ZZZU-0000002");

    await wrapper.get(".quick-filters button:first-child").trigger("click");
    await wrapper.get('button[aria-label="按货柜升序排列"]').trigger("click");
    expect(
      wrapper.findAll('tbody td[data-column-code="containerNumber"]')[0].text(),
    ).toContain("AAAU-0000001");

    await wrapper.get("summary").trigger("click");
    await wrapper
      .get('[data-testid="column-toggle-reference"]')
      .setValue(false);
    expect(wrapper.findAll("th").map((cell) => cell.text())).not.toContain(
      "参考号",
    );
    expect(wrapper.find('[data-column-code="reference"]').exists()).toBe(false);
    expect((wrapper.get("details").element as HTMLDetailsElement).open).toBe(
      true,
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect((wrapper.get("details").element as HTMLDetailsElement).open).toBe(
      false,
    );
  });

  it("emits the stable row id from identity and action controls", async () => {
    const wrapper = mount(DynamicDataTable, {
      props: { projection: createProjection(), filter: "all" },
    });

    await wrapper.get(".identity-action").trigger("click");
    await wrapper.get(".open-row").trigger("click");
    expect(wrapper.emitted("openRow")).toEqual([["row-b"], ["row-b"]]);
  });

  it("shows a newly authorized schema column without changing the component", async () => {
    const projection = createProjection();
    const wrapper = mount(DynamicDataTable, {
      props: { projection, filter: "all" },
    });
    const extendedProjection: DataTableProjection = {
      ...projection,
      schema: {
        ...projection.schema,
        schemaVersion: 2,
        columns: [
          ...projection.schema.columns,
          {
            code: "carrier",
            label: "船司",
            kind: "text",
            order: 55,
            width: 100,
          },
        ],
      },
      rows: projection.rows.map((row) => ({
        ...row,
        values: { ...row.values, carrier: "MAERSK" },
      })),
    };

    await wrapper.setProps({ projection: extendedProjection });

    expect(wrapper.findAll("th").map((cell) => cell.text())).toContain("船司");
    expect(wrapper.text()).toContain("MAERSK");
  });

  it("fails visibly when the server display schema is invalid", () => {
    const projection = createProjection();
    const wrapper = mount(DynamicDataTable, {
      props: {
        projection: {
          ...projection,
          schema: {
            ...projection.schema,
            columns: [
              projection.schema.columns[0],
              projection.schema.columns[0],
            ],
          },
        },
      },
    });

    expect(wrapper.get('[role="alert"]').text()).toContain("表格配置不可用");
    expect(wrapper.get('[role="alert"]').text()).toContain("列码重复");
    expect(wrapper.find("table").exists()).toBe(false);
  });
});
