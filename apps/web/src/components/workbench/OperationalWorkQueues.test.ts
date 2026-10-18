import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import CargoReadyWorkQueue from "../cargo-ready/CargoReadyWorkQueue.vue";
import CustomsWorkQueue from "../customs/CustomsWorkQueue.vue";
import DeliveryWorkQueue from "../delivery/DeliveryWorkQueue.vue";
import DispatchWorkQueue from "../dispatch/DispatchWorkQueue.vue";
import PickupWorkQueue from "../pickup/PickupWorkQueue.vue";
import StuffingWorkQueue from "../stuffing/StuffingWorkQueue.vue";
import UnloadingWorkQueue from "../unloading/UnloadingWorkQueue.vue";
import type { CargoReadyQueueItem } from "../../data/cargoReadyWorkbench";
import { buildCustomsQueue } from "../../data/customsWorkbench";
import { buildDeliveryQueue } from "../../data/deliveryWorkbench";
import { buildDispatchQueue } from "../../data/dispatchWorkbench";
import { buildPickupQueue } from "../../data/pickupWorkbench";
import { buildUnloadingQueue } from "../../data/unloadingWorkbench";
import type { StuffingQueueItem } from "../../data/stuffingWorkbench";

describe("operational work queues", () => {
  it("shows the attention reason and next step in every queue row", () => {
    const cases = [
      {
        label: "出运",
        wrapper: mount(DispatchWorkQueue, {
          props: {
            items: buildDispatchQueue({
              tasks: [task("shipment_dispatch")],
              containers: [],
            }),
            selectedTaskId: "",
            loading: false,
          },
        }),
      },
      {
        label: "清关",
        wrapper: mount(CustomsWorkQueue, {
          props: {
            items: buildCustomsQueue({
              tasks: [task("customs_clearance")],
              containers: [],
            }),
            selectedTaskId: "",
            loading: false,
          },
        }),
      },
      {
        label: "提柜",
        wrapper: mount(PickupWorkQueue, {
          props: {
            items: buildPickupQueue({
              tasks: [task("container_pickup")],
              containers: [],
            }),
            selectedTaskId: "",
            loading: false,
          },
        }),
      },
      {
        label: "送仓",
        wrapper: mount(DeliveryWorkQueue, {
          props: {
            items: buildDeliveryQueue({
              tasks: [task("warehouse_delivery")],
              containers: [],
            }),
            selectedTaskId: "",
            loading: false,
          },
        }),
      },
      {
        label: "卸柜",
        wrapper: mount(UnloadingWorkQueue, {
          props: {
            items: buildUnloadingQueue({
              tasks: [task("container_unloading")],
              containers: [],
            }),
            selectedTaskId: "",
            loading: false,
          },
        }),
      },
    ];

    for (const { label, wrapper } of cases) {
      expect(wrapper.text()).toContain(`为什么：${label}任务已进入共享任务池`);
      expect(wrapper.text()).toContain("下一步：领取后开始处理");
    }
  });

  it("leaves vertical scrolling to the shared pane owner", () => {
    const cargoReadyStyles = installComponentStyles(
      "../cargo-ready/CargoReadyWorkQueue.vue",
    );
    const stuffingStyles = installComponentStyles(
      "../stuffing/StuffingWorkQueue.vue",
    );
    const cargoReady = mount(CargoReadyWorkQueue, {
      attachTo: document.body,
      props: {
        items: [cargoReadyItem()],
        selectedOrderId: "",
        filter: "all",
        loading: false,
        error: "",
      },
    });
    const stuffing = mount(StuffingWorkQueue, {
      attachTo: document.body,
      props: {
        items: [stuffingItem()],
        selectedTaskId: "",
        selectedContainerId: "",
        filter: "all",
        loading: false,
        error: "",
      },
    });

    for (const wrapper of [cargoReady, stuffing]) {
      const queueList = wrapper.get<HTMLElement>(".queue-list").element;
      const style = getComputedStyle(queueList);
      expect(style.maxHeight).not.toBe("680px");
      expect(style.overflowY).not.toMatch(/auto|scroll/);
    }
    expect(
      getComputedStyle(stuffing.get<HTMLElement>(".queue-filters").element)
        .overflowX,
    ).toBe("auto");

    cargoReady.unmount();
    stuffing.unmount();
    cargoReadyStyles.remove();
    stuffingStyles.remove();
  });
});

function installComponentStyles(relativePath: string): HTMLStyleElement {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sourceDocument = new DOMParser().parseFromString(source, "text/html");
  const element = document.createElement("style");
  element.textContent = Array.from(sourceDocument.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");
  document.head.appendChild(element);
  return element;
}

function cargoReadyItem(): CargoReadyQueueItem {
  return {
    order: {
      id: "order-1",
      orderNumber: "26DSC01812",
      updatedAt: "2026-09-21T00:00:00.000Z",
    } as CargoReadyQueueItem["order"],
    title: "补合规资料",
    detail: "1 个 SKU 缺少适用资料",
    responsibility: "mine",
    relatedContainerLabel: "HMMU4956442",
    lineCount: 1,
    gapCount: 1,
    gapUnit: "个 SKU",
  };
}

function stuffingItem(): StuffingQueueItem {
  return {
    kind: "historical_snapshot",
    container: {
      id: "container-1",
      orderNumber: "26DSC01812",
      containerNumber: "HMMU4956442",
      currentStatus: "shipped",
      updatedAt: "2026-09-21T00:00:00.000Z",
    },
    title: "查看历史装箱事实",
    responsibility: "只读历史",
    urgencyLabel: "历史",
    urgencyRank: 4,
    actionLabel: "查看只读快照",
  };
}

function task(nodeCode: string): NodeTaskDetail {
  return {
    id: `task-${nodeCode}`,
    flowInstanceId: "flow-1",
    nodeInstanceId: `node-${nodeCode}`,
    nodeCode,
    containerId: null,
    taskDefinitionKey: `node-${nodeCode}`,
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: `work-${nodeCode}`,
      workOrderDefinitionKey: nodeCode,
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
