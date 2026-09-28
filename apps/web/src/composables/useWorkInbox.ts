import { computed, shallowRef, watch, type Ref } from "vue";
import type {
  ShipmentWorkHandoffV1,
  WorkHandoffRecipientV1,
} from "../api/shipments";
import {
  claimShipmentWorkHandoff,
  closeShipmentWorkHandoff,
  listWorkHandoffQueue,
} from "../api/shipments";

/**
 * 专业岗位待办：出运运营交过来的事项，本岗位领取、办理、写结论了结。
 *
 * **领取与了结都是"领了才是你的活"**：没领的不能结，不是你领的不能由你结 ——
 * 服务端这么判，界面也不给按不动的按钮。
 */
export function useWorkInbox(options: {
  recipient: Ref<WorkHandoffRecipientV1>;
}) {
  const items = shallowRef<ShipmentWorkHandoffV1[]>([]);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef("");
  const receipt = shallowRef("");

  const waiting = computed(() =>
    items.value.filter((item) => item.state === "raised"),
  );
  const mine = computed(() =>
    items.value.filter((item) => item.state === "claimed"),
  );

  watch(options.recipient, () => void load(), { immediate: true });

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const page = await listWorkHandoffQueue({
        recipient: options.recipient.value,
      });
      items.value = page.items;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法加载岗位待办";
    } finally {
      loading.value = false;
    }
  }

  async function claim(handoff: ShipmentWorkHandoffV1): Promise<void> {
    await act(
      () =>
        claimShipmentWorkHandoff(handoff.handoffId, {
          contractVersion: "shipment-work-handoff-claim.v1",
          expectedVersion: handoff.version,
          idempotencyKey: `claim:${handoff.handoffId}:${handoff.version}`,
        }),
      "已领取，这一件归你办",
    );
  }

  /** 了结**必须给结论** —— 交出去的人靠这句话判断这一票能不能往下走。 */
  async function close(
    handoff: ShipmentWorkHandoffV1,
    conclusion: string,
  ): Promise<boolean> {
    if (!conclusion.trim()) return false;
    return act(
      () =>
        closeShipmentWorkHandoff(handoff.handoffId, {
          contractVersion: "shipment-work-handoff-close.v1",
          expectedVersion: handoff.version,
          conclusion: conclusion.trim(),
          idempotencyKey: `close:${handoff.handoffId}:${handoff.version}`,
        }),
      "已了结，出运运营会看到你的结论",
    );
  }

  async function act(
    run: () => Promise<ShipmentWorkHandoffV1>,
    success: string,
  ): Promise<boolean> {
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      await run();
      await load();
      receipt.value = success;
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法完成这个动作";
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    items,
    waiting,
    mine,
    loading,
    saving,
    error,
    receipt,
    load,
    claim,
    close,
  };
}
