import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { achievementCalendars, achievementRows } from "../../data/sample";
import AchievementCalendar from "./AchievementCalendar.vue";

describe("AchievementCalendar", () => {
  it("switches between month, week, and day calendar buckets", async () => {
    const wrapper = mount(AchievementCalendar, {
      props: {
        calendars: {
          month: {
            columns: [{ key: "w30", label: "W30", isCurrent: true }],
            rows: [
              {
                stage: "清关",
                tone: "warn" as const,
                values: { w30: "10/15" },
              },
              {
                stage: "提柜",
                tone: "ok" as const,
                values: {},
              },
            ],
          },
          week: {
            columns: [{ key: "monday", label: "周一", isCurrent: true }],
            rows: [
              {
                stage: "清关",
                tone: "warn" as const,
                values: { monday: "2/3" },
              },
            ],
          },
          day: {
            columns: [{ key: "0800", label: "08:00", isCurrent: true }],
            rows: [
              {
                stage: "清关",
                tone: "warn" as const,
                values: { "0800": "1/1" },
              },
            ],
          },
        },
      },
    });

    const calendar = wrapper.get('table[aria-label="计划与达成，完成 / 计划"]');
    expect(calendar.text()).toContain("节点W30清关10/15");
    expect(calendar.text()).toContain("提柜缺数据");
    expect(wrapper.get('button[aria-pressed="true"]').text()).toBe("月");

    await wrapper.get(".period-switch button:nth-child(2)").trigger("click");
    expect(calendar.text()).toContain("节点周一清关2/3");
    expect(calendar.text()).not.toContain("W30");
    expect(wrapper.get('button[aria-pressed="true"]').text()).toBe("周");

    await wrapper.get(".period-switch button:nth-child(3)").trigger("click");
    expect(calendar.text()).toContain("节点08:00清关1/1");
    expect(calendar.text()).not.toContain("周一");
    expect(wrapper.get('button[aria-pressed="true"]').text()).toBe("日");
    expect(calendar.find("[role='progressbar']").exists()).toBe(false);
    expect(wrapper.get("#achievement-title").text()).toBe("计划与达成");
    expect(wrapper.text()).toContain("完成 / 计划");
  });

  it("keeps calendar buckets reconciled with the aggregate projection", () => {
    const dimensions = ["month", "week", "day"] as const;

    for (const dimension of dimensions) {
      const calendar = achievementCalendars[dimension];
      for (const row of calendar.rows) {
        const aggregate = achievementRows.find(
          (item) => item.stage === row.stage,
        );
        const total = calendar.columns.reduce(
          (result, column) => {
            const [completed, planned] = row.values[column.key]
              .split("/")
              .map(Number);
            return {
              completed: result.completed + completed,
              planned: result.planned + planned,
            };
          },
          { completed: 0, planned: 0 },
        );

        expect(`${total.completed}/${total.planned}`).toBe(
          aggregate?.[dimension],
        );
      }
    }
  });
});
