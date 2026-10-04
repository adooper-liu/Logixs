import { computed, shallowRef, type Ref } from "vue";
import type {
  NominateSupplierCommandV1,
  RecordQuotationCommandV1,
  SupplierNominationHandoffV1,
  SupplierQuotationV1,
  SupplierV1,
} from "@logix/contracts";
import {
  admitSupplier,
  listSourcingQueue,
  nominateSupplier,
  recordQuotation,
  registerSupplier,
  type SourcingQueueEntry,
} from "../api/sourcing";

/**
 * 报价的价格档按录入顺序原样列出。金额是十进制字符串，前端不换算、不比大小；
 * 跨家可比性与排名只能由服务端判定。
 */
export function priceTierLabels(quotation: SupplierQuotationV1): string[] {
  return quotation.priceTiers.map(
    (tier) => `${tier.minQuantity} 起 ${tier.unitPrice} ${tier.currency}`,
  );
}

/** 队列条目的稳定键：**一份发布里的一个 SKU** —— 寻源的对象是它，不是"这一票"。 */
export function entryKey(entry: {
  skuReleaseId: string;
  skuId: string;
}): string {
  return `${entry.skuReleaseId}::${entry.skuId}`;
}

export function parseEntryKey(key: string): {
  skuReleaseId: string;
  skuId: string;
} {
  const [skuReleaseId = "", skuId = ""] = key.split("::");
  return { skuReleaseId, skuId };
}

/**
 * 寻源工作台：为一件可售 SKU 收齐报价，选定一家定点。
 *
 * **候选供应商不是事先指定的名单** —— 谁报过价谁就是候选。所以界面上的顺序是：
 * 先登记供应商 → 让他们报价 → 在报过价的里面定一家。
 */
export function useSourcingWorkbench(options: { selectedKey: Ref<string> }) {
  const suppliers = shallowRef<SupplierV1[]>([]);
  const entries = shallowRef<SourcingQueueEntry[]>([]);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef("");
  const receipt = shallowRef("");

  const selected = computed(
    () =>
      entries.value.find(
        (entry) => entryKey(entry) === options.selectedKey.value,
      ) ?? null,
  );
  const waiting = computed(() =>
    entries.value.filter((entry) => !entry.nominated),
  );
  const nominated = computed(() =>
    entries.value.filter((entry) => entry.nominated),
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const page = await listSourcingQueue();
      suppliers.value = page.suppliers;
      entries.value = page.entries;
    } catch (failure) {
      error.value =
        failure instanceof Error
          ? failure.message
          : "暂时无法加载待寻源的可售 SKU";
    } finally {
      loading.value = false;
    }
  }

  async function addSupplier(command: {
    name: string;
    countryCode: string;
  }): Promise<boolean> {
    return act(async () => {
      await registerSupplier({
        contractVersion: "supplier-register.v1",
        name: command.name,
        countryCode: command.countryCode,
        admissionState: "pending",
        idempotencyKey: `register:${command.name}`,
      });
      return "已登记供应商（待准入）";
    });
  }

  async function admit(supplier: SupplierV1): Promise<boolean> {
    return act(async () => {
      await admitSupplier(supplier.supplierId, {
        contractVersion: "supplier-admit.v1",
        expectedSupplierVersion: supplier.version,
        idempotencyKey: `admit:${supplier.supplierId}:${supplier.version}`,
      });
      return "已准入供应商";
    });
  }

  async function addQuotation(
    supplierId: string,
    command: Omit<
      RecordQuotationCommandV1,
      "contractVersion" | "expectedQuotationVersion" | "idempotencyKey"
    >,
  ): Promise<boolean> {
    const current = selected.value;
    if (!current) return false;
    const existing = current.quotations.find(
      (quotation) => quotation.supplierId === supplierId,
    );
    return act(async () => {
      await recordQuotation(
        {
          supplierId,
          skuReleaseId: current.skuReleaseId,
          skuId: current.skuId,
        },
        {
          contractVersion: "supplier-quotation-record.v1",
          expectedQuotationVersion: existing?.version ?? 0,
          ...command,
          idempotencyKey: `quote:${current.skuReleaseId}:${current.skuId}:${supplierId}:${existing?.version ?? 0}`,
        },
      );
      return "已录入报价";
    });
  }

  /** 定点：选定一家的报价，写下样品结论与产能约束。 */
  async function nominate(
    quotation: SupplierQuotationV1,
    command: Pick<
      NominateSupplierCommandV1,
      "sampleConclusion" | "capacityConstraint"
    >,
  ): Promise<boolean> {
    const saved = await act(async () => {
      await nominateSupplier({
        contractVersion: "supplier-nominate.v1",
        quotationId: quotation.quotationId,
        expectedQuotationVersion: quotation.version,
        sampleConclusion: command.sampleConclusion,
        capacityConstraint: command.capacityConstraint,
        idempotencyKey: `nominate:${quotation.quotationId}:${quotation.version}`,
      });
      return "已定点，待需求与补货侧明确接受";
    });
    if (saved) await load();
    return saved;
  }

  async function act(run: () => Promise<string>): Promise<boolean> {
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      const message = await run();
      await load();
      receipt.value = message;
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
    suppliers,
    entries,
    waiting,
    nominated,
    selected,
    loading,
    saving,
    error,
    receipt,
    load,
    addSupplier,
    admit,
    addQuotation,
    nominate,
  };
}

export type { SupplierNominationHandoffV1, SourcingQueueEntry };
