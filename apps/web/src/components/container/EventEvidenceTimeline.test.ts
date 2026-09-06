import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { EventRow } from "../../data/sample";
import EventEvidenceTimeline from "./EventEvidenceTimeline.vue";

const events: EventRow[] = [
  {
    eventCode: "gate_out",
    label: "提柜出闸",
    actual: "实际 09-10 08:20",
    evidence: "闸口 EIR",
  },
  {
    eventCode: "warehouse_arrival",
    label: "到仓",
    planned: "计划 09-10 08:40",
    evidence: "门岗记录",
  },
];

describe("EventEvidenceTimeline", () => {
  it("renders ordered event facts with visible actual-state semantics", () => {
    const wrapper = mount(EventEvidenceTimeline, { props: { events } });
    const rows = wrapper.findAll('[data-testid="event-evidence"]');

    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("01提柜出闸");
    expect(rows[0].text()).toContain("实际 09-10 08:20");
    expect(rows[0].text()).toContain("已发生");
    expect(rows[1].text()).toContain("02到仓");
    expect(rows[1].text()).toContain("待发生");
    expect(rows[1].text()).toContain("门岗记录");
  });
});
