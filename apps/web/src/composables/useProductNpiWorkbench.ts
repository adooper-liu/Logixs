import { computed, ref, shallowRef, type Ref } from "vue";
import type { ProductInitiativeNpiQueueEntryV1 } from "@logix/contracts";
import { DEV_OPERATOR_ID } from "../api/developmentIdentity";
import {
  claimProductInitiative,
  listProductInitiativeNpiQueue,
  returnProductInitiativeFromNpi,
} from "../api/marketSignals";

/**
 * 产品开发与 NPI 工作台：看见选品交过来的立项，把其中一件接到自己名下。
 *
 * 队列按"等谁动"分两组 —— **待领取**（还没人接，该我判断）与**已领取**
 * （已在某人手上，显示是谁）。这是操作第一眼要分的事：哪些等我，哪些不用我管。
 *
 * 「我负责的」用请求头里那个身份判断，与服务端落库的负责人同源；前端不自己编一个"我"。
 */
export function useProductNpiWorkbench(options: {
  selectedId: Ref<string>;
  selectInitiative: (handoffId: string) => void | Promise<void>;
}) {
  const items = ref<ProductInitiativeNpiQueueEntryV1[]>([]);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef("");
  const receipt = shallowRef("");

  const selected = computed(
    () =>
      items.value.find(
        (item) => item.handoff.handoffId === options.selectedId.value,
      ) ?? null,
  );
  const waiting = computed(() => items.value.filter((item) => !item.claim));
  const mine = computed(() =>
    items.value.filter(
      (item) => item.claim?.productOwnerActorId === DEV_OPERATOR_ID,
    ),
  );
  const takenByOthers = computed(() =>
    items.value.filter(
      (item) =>
        item.claim && item.claim.productOwnerActorId !== DEV_OPERATOR_ID,
    ),
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      items.value = (await listProductInitiativeNpiQueue()).items;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法加载产品侧待办";
    } finally {
      loading.value = false;
    }
  }

  /**
   * 领取选中的那条。领取不许诺任何立项结论 —— 只是把推进责任落到人头上。
   * 返回是否成功，调用方据此决定要不要重读队列。
   */
  async function claim(): Promise<boolean> {
    const current = selected.value;
    if (!current) return false;
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      const claimed = await claimProductInitiative(current.handoff.handoffId, {
        contractVersion: "product-initiative-claim.v1",
        expectedClaimVersion: current.claim?.claimVersion ?? 0,
        idempotencyKey: `claim:${current.handoff.handoffId}:${
          current.claim?.claimVersion ?? 0
        }`,
      });
      receipt.value = `已接到你名下：${claimed.handoff.objective}`;
      await load();
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法领取该立项";
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function returnToSelection(returnReason: string): Promise<boolean> {
    const current = selected.value;
    if (!current?.claim) return false;
    const reason = returnReason.trim();
    if (!reason) {
      error.value = "退回选品必须填写理由";
      return false;
    }
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      await returnProductInitiativeFromNpi(current.handoff.handoffId, {
        contractVersion: "product-initiative-npi-return.v1",
        expectedInitiativeVersion: current.initiativeVersion,
        returnReason: reason,
        idempotencyKey: `npi-return:${current.handoff.handoffId}:v${current.initiativeVersion}`,
      });
      receipt.value = `已退回选品：${reason}`;
      await load();
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法退回选品";
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    items,
    selected,
    waiting,
    mine,
    takenByOthers,
    loading,
    saving,
    error,
    receipt,
    load,
    claim,
    returnToSelection,
  };
}
