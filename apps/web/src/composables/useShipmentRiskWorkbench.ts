import { computed, reactive, shallowRef, watch, type Ref } from "vue";
import type {
  ShipmentRiskQueueEntryV1,
  ShipmentWorkHandoffV1,
  ShipmentRiskSortV1,
  WorkHandoffRecipientV1,
} from "../api/shipments";
import {
  listShipmentRiskQueue,
  listShipmentWorkHandoffs,
  raiseShipmentWorkHandoff,
} from "../api/shipments";

/** 四个专业岗位。**只到岗位不到人** —— 交出去的人不必知道今天谁在班。 */
export const RECIPIENTS: { code: WorkHandoffRecipientV1; label: string }[] = [
  { code: "customs", label: "清关" },
  { code: "pickup", label: "提柜" },
  { code: "delivery", label: "送仓" },
  { code: "unloading", label: "卸柜" },
];

export const SORT_LABELS: { code: ShipmentRiskSortV1; label: string }[] = [
  { code: "nearest_deadline", label: "离最近约束" },
  { code: "eta", label: "预计到港" },
  { code: "task_due", label: "任务截止" },
  { code: "updated_at", label: "最近更新" },
];

/**
 * 队列按**归谁动**分组，而不是按严重度。
 *
 * **分组维度不能与排序维度是同一个**：一件票可以既临期又待我，按"临期"分组会把它
 * 从"待我"里挪走 —— 而那正是最该被看见的一批。所以"临期"只做标签与排序，
 * 不进分组。
 *
 * 优先级：先处理异常 → 等待他人 → 待我。一票只进一组，不重复出现。
 */
export type RiskGroupCode = "exceptions" | "waiting" | "mine";

export const RISK_GROUPS: { code: RiskGroupCode; label: string }[] = [
  { code: "exceptions", label: "先处理异常" },
  { code: "waiting", label: "等待他人" },
  { code: "mine", label: "待我处理" },
];

export function groupOf(
  entry: ShipmentRiskQueueEntryV1,
  openHandoffs: readonly ShipmentWorkHandoffV1[],
): RiskGroupCode {
  if (entry.risk.openExceptionCount + entry.risk.unassignedExceptionCount > 0) {
    return "exceptions";
  }
  if (openHandoffs.length > 0) return "waiting";
  return "mine";
}

/**
 * 剩余时间只显示**事实**，不设"临期"阈值 —— 阈值是业务政策，而现在没有数据
 * 支撑它。"还有 3 天 4 小时"不需要谁批准。
 */
export function remainingLabel(
  at: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!at) return "没有截止";
  const deadline = new Date(at);
  const diffMs = deadline.getTime() - now.getTime();
  const overdue = diffMs < 0;
  const totalHours = Math.floor(Math.abs(diffMs) / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const span = days > 0 ? `${days} 天 ${hours} 小时` : `${hours} 小时`;
  return overdue ? `已逾期 ${span}` : `还有 ${span}`;
}

export function useShipmentRiskWorkbench(options: { selectedId: Ref<string> }) {
  const items = shallowRef<ShipmentRiskQueueEntryV1[]>([]);
  const sort = shallowRef<ShipmentRiskSortV1>("nearest_deadline");
  /** shipmentId → 这一票已交出去、还没了结的事项。 */
  const openHandoffs = reactive(new Map<string, ShipmentWorkHandoffV1[]>());
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef("");
  const receipt = shallowRef("");

  const selected = computed(
    () =>
      items.value.find(
        (item) => item.shipment.id === options.selectedId.value,
      ) ?? null,
  );
  const openOf = (shipmentId: string) => openHandoffs.get(shipmentId) ?? [];
  const groups = computed(() =>
    RISK_GROUPS.map((group) => ({
      ...group,
      items: items.value.filter(
        (item) => groupOf(item, openOf(item.shipment.id)) === group.code,
      ),
    })),
  );

  watch(
    () => options.selectedId.value,
    (shipmentId) => void loadHandoffs(shipmentId),
    { immediate: true },
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const page = await listShipmentRiskQueue({ sort: sort.value });
      items.value = page.items;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法加载风险队列";
    } finally {
      loading.value = false;
    }
  }

  async function loadHandoffs(shipmentId: string): Promise<void> {
    if (!shipmentId) return;
    try {
      const handoffs = await listShipmentWorkHandoffs(shipmentId);
      openHandoffs.set(
        shipmentId,
        handoffs.filter((handoff) => handoff.state !== "closed"),
      );
    } catch {
      // 读不到"交出去的事项"不该把整页拦下 —— 队列本身还能用。
      openHandoffs.set(shipmentId, []);
    }
  }

  async function changeSort(next: ShipmentRiskSortV1): Promise<void> {
    sort.value = next;
    await load();
  }

  /** 交给专业岗位。交出去之后这一票从"待我"移到"等待他人"，不用另建状态。 */
  async function handOff(
    recipient: WorkHandoffRecipientV1,
    title: string,
    detail: string,
  ): Promise<boolean> {
    const current = selected.value;
    if (!current || !title.trim()) return false;
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      await raiseShipmentWorkHandoff({
        contractVersion: "shipment-work-handoff-raise.v1",
        shipmentId: current.shipment.id,
        recipientQueueCode: recipient,
        title: title.trim(),
        ...(detail.trim() ? { detail: detail.trim() } : {}),
        idempotencyKey: `raise:${current.shipment.id}:${recipient}:${title.trim()}`,
      });
      await loadHandoffs(current.shipment.id);
      receipt.value = `已交给${RECIPIENTS.find((r) => r.code === recipient)?.label}岗位`;
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法交给该岗位";
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    items,
    sort,
    groups,
    selected,
    openHandoffs,
    openOf,
    loading,
    saving,
    error,
    receipt,
    load,
    changeSort,
    handOff,
  };
}
