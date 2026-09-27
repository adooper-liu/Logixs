import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import CustomsWorkQueue from "../customs/CustomsWorkQueue.vue";
import DeliveryWorkQueue from "../delivery/DeliveryWorkQueue.vue";
import DispatchWorkQueue from "../dispatch/DispatchWorkQueue.vue";
import PickupWorkQueue from "../pickup/PickupWorkQueue.vue";
import UnloadingWorkQueue from "../unloading/UnloadingWorkQueue.vue";
import { buildCustomsQueue } from "../../data/customsWorkbench";
import { buildDeliveryQueue } from "../../data/deliveryWorkbench";
import { buildDispatchQueue } from "../../data/dispatchWorkbench";
import { buildPickupQueue } from "../../data/pickupWorkbench";
import { buildUnloadingQueue } from "../../data/unloadingWorkbench";

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
});

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
