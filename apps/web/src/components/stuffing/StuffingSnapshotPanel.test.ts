import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StuffingSnapshotPanel from "./StuffingSnapshotPanel.vue";

const cargo = {
  containerRecordId: "container-1",
  allocationSetId: "allocation-1",
  allocationSetVersion: 1,
  items: Array.from({ length: 15 }, (_, index) => ({
    replenishmentOrderLineId: `line-${index}`,
    productSkuId: `sku-${index}`,
    productNumber: `PRODUCT-${String(index + 1).padStart(2, "0")}`,
    allocatedQuantity: index === 14 ? "490" : "1",
    quantityUnit: index >= 12 ? "set" : "piece",
  })),
};

const snapshot = {
  snapshotId: "snapshot-1",
  containerRecordId: "container-1",
  version: 1,
  allocationSetId: "allocation-1",
  allocationSetVersion: 1,
  containerNumber: "HMMU4956442",
  sealNumber: "26H0407525",
  packageCount: 504,
  grossWeight: "7723",
  grossWeightUnit: "KGM" as const,
  netWeight: null,
  volume: "67.25",
  volumeUnit: "MTQ" as const,
  vgm: null,
  ingestionChannel: "file_import" as const,
  sourceSystem: "full-chain-sample",
  evidenceRefs: ["evidence-1"],
  actorId: "source-import-service",
  reasonCode: "historical_stuffing_imported",
  createdAt: "2026-10-15T08:00:00.000Z",
  duplicate: false,
};

describe("StuffingSnapshotPanel", () => {
  it("keeps historical SKU lines collapsed until the operator asks to inspect them", async () => {
    const wrapper = mount(StuffingSnapshotPanel, {
      props: { cargo, snapshot, node: null, historicalMode: true },
    });

    expect(wrapper.text()).toContain("15 个 SKU 明细");
    expect(wrapper.text()).toContain("full-chain-sample · file_import");
    expect(wrapper.text()).toContain("查看来源摘要");
    await wrapper.get("details.evidence-summary summary").trigger("click");
    expect(wrapper.text()).toContain("证据引用");
    expect(wrapper.text()).not.toContain("写入前已核验有效");
    expect(wrapper.text()).not.toContain("evidence-1");
    expect(wrapper.text()).not.toContain("PRODUCT-01");

    await wrapper
      .get('button[aria-controls="historical-cargo-lines"]')
      .trigger("click");

    expect(wrapper.text()).toContain("PRODUCT-01");
    expect(wrapper.text()).toContain("PRODUCT-15");
  });
});
