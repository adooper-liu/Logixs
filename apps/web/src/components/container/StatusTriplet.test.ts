import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { StatusView } from "../../data/sample";
import StatusTriplet from "./StatusTriplet.vue";

const status = (
  code: string,
  label: string,
  tone: StatusView["tone"],
): StatusView => ({ code, label, tone, changedAt: "09-10 08:20" });

describe("StatusTriplet", () => {
  it("removes idle sync from the visual band and restores it when relevant", async () => {
    const wrapper = mount(StatusTriplet, {
      props: {
        containerStatus: status("picked_up", "已提柜", "ok"),
        taskStatus: status("available", "卸柜任务待领取", "info"),
        syncStatus: status("idle", "无待确认操作", "muted"),
        showIdleSync: false,
        compact: true,
      },
    });

    expect(wrapper.findAll('[data-testid="status-cell"]')).toHaveLength(2);
    expect(wrapper.text()).not.toContain("无待确认操作");

    await wrapper.setProps({
      syncStatus: status("committed", "最近操作已落账", "ok"),
    });

    expect(wrapper.findAll('[data-testid="status-cell"]')).toHaveLength(3);
    expect(wrapper.text()).toContain("最近操作已落账");
  });
});
