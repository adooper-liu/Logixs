import {
  computed,
  reactive,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import type {
  ProductAttributesV1,
  ProductIdentityV1,
  ProductSkuAttributesV1,
} from "@logix/contracts";
import {
  draftProductIdentity,
  getProductIdentity,
  listProductIdentityQueue,
  releaseSellableSku,
} from "../api/marketSignals";

export interface IdentityQueueItem {
  releaseId: string;
  definitionId: string;
  specification: string;
  npiStage: string;
  releasedBy: string;
  releasedAt: string;
  productId: string | null;
  productNumber: string | null;
}

/**
 * 发布前必须齐的 SPU 层属性。**与服务端领域规则同一份口径** ——
 * 前端先说清差什么，别让人填完才被 400 拒绝。
 */
export const RELEASE_REQUIRED_FIELDS = [
  { key: "categoryCode", label: "品类" },
  { key: "functionalName", label: "功能名" },
  { key: "countryOfOrigin", label: "原产国" },
  { key: "hsCode", label: "HS 编码" },
] as const;

export function emptySkuAttributes(): ProductSkuAttributesV1 {
  return {
    colorCode: null,
    sizeDescription: null,
    netContent: null,
    grossWeight: null,
    dimensions: null,
    packaging: {
      itemsPerLayer: null,
      completedLayers: null,
      itemsPerConsumerUnit: null,
      consumerUnitsPerInnerPack: null,
    },
    stackingFactor: null,
    maxStackingWeight: null,
    barcode: null,
    battery: null,
  };
}

export function emptyAttributes(): ProductAttributesV1 {
  return {
    categoryCode: null,
    brandName: null,
    subBrandName: null,
    modelNumber: null,
    functionalName: null,
    countryOfOrigin: null,
    hsCode: null,
    targetCountries: [],
    certifications: [],
    temperature: null,
    dangerousGoods: null,
    orderConditions: {
      leadTimeDays: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      orderSizingFactor: null,
      orderMultiple: null,
    },
  };
}

interface SkuDraft {
  skuId: string | null;
  skuCode: string;
  attributes: ProductSkuAttributesV1;
}

export function useProductIdentity(options: {
  selectedId: MaybeRefOrGetter<string>;
}) {
  const queue = shallowRef<IdentityQueueItem[]>([]);
  const identity = shallowRef<ProductIdentityV1 | null>(null);
  const draft = reactive<{
    productNumber: string;
    attributes: ProductAttributesV1;
    skus: SkuDraft[];
  }>({ productNumber: "", attributes: emptyAttributes(), skus: [] });
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef("");
  const receipt = shallowRef("");

  const selected = computed(
    () =>
      queue.value.find(
        (item) => item.releaseId === toValue(options.selectedId),
      ) ?? null,
  );
  const waiting = computed(() => queue.value.filter((item) => !item.productId));
  const drafted = computed(() => queue.value.filter((item) => item.productId));

  /**
   * 发布前还差什么，**逐项列出**。只说"还不能发布"等于让人自己猜 ——
   * 这是从选品立项那个 bug 学来的。
   */
  const releaseGaps = computed<string[]>(() => {
    const missing: string[] = [];
    if (!draft.productNumber.trim()) missing.push("产品号");
    if (draft.skus.length === 0) missing.push("至少一个 SKU");
    for (const field of RELEASE_REQUIRED_FIELDS) {
      if (!draft.attributes[field.key]) missing.push(field.label);
    }
    if (draft.attributes.targetCountries.length === 0) {
      missing.push("目标销售国家");
    }
    return missing;
  });

  let loadToken = 0;
  watch(
    () => toValue(options.selectedId),
    () => void loadIdentity(),
    { immediate: true },
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      queue.value = (await listProductIdentityQueue()).items;
    } catch (failure) {
      error.value =
        failure instanceof Error
          ? failure.message
          : "暂时无法加载待建档的产品设计";
    } finally {
      loading.value = false;
    }
  }

  async function loadIdentity(): Promise<void> {
    const releaseId = toValue(options.selectedId);
    const token = ++loadToken;
    if (!releaseId) {
      identity.value = null;
      resetDraft();
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const loaded = await getProductIdentity(releaseId);
      if (token !== loadToken) return;
      identity.value = loaded;
      draft.productNumber = loaded?.productNumber ?? "";
      draft.attributes = loaded?.attributes ?? emptyAttributes();
      draft.skus = loaded
        ? loaded.skus.map((sku) => ({
            skuId: sku.skuId,
            skuCode: sku.skuCode,
            attributes: sku.attributes,
          }))
        : [{ skuId: null, skuCode: "", attributes: emptySkuAttributes() }];
    } catch (failure) {
      if (token !== loadToken) return;
      error.value =
        failure instanceof Error ? failure.message : "暂时无法加载产品身份";
    } finally {
      if (token === loadToken) loading.value = false;
    }
  }

  function resetDraft(): void {
    draft.productNumber = "";
    draft.attributes = emptyAttributes();
    draft.skus = [];
  }

  function addSku(): void {
    draft.skus.push({
      skuId: null,
      skuCode: "",
      attributes: emptySkuAttributes(),
    });
  }

  function removeSku(index: number): void {
    draft.skus.splice(index, 1);
  }

  /** 存一版。**存半成品是对的** —— 主数据是逐步查清的。 */
  async function save(): Promise<boolean> {
    const releaseId = toValue(options.selectedId);
    if (!releaseId) return false;
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      const saved = await draftProductIdentity(releaseId, {
        contractVersion: "product-identity-draft.v1",
        expectedVersion: identity.value?.version ?? 0,
        ...(draft.productNumber.trim()
          ? { productNumber: draft.productNumber.trim() }
          : {}),
        attributes: draft.attributes,
        skus: draft.skus.map((sku) => ({
          ...(sku.skuId ? { skuId: sku.skuId } : {}),
          skuCode: sku.skuCode.trim(),
          attributes: sku.attributes,
        })) as never,
        idempotencyKey: `identity:${releaseId}:${identity.value?.version ?? 0}`,
      });
      identity.value = saved;
      await load();
      receipt.value = `已保存（第 ${saved.version} 版）`;
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法保存产品身份";
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function release(): Promise<boolean> {
    const releaseId = toValue(options.selectedId);
    if (!releaseId || !identity.value) return false;
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      const released = await releaseSellableSku(releaseId, {
        contractVersion: "sellable-sku-release.v1",
        expectedVersion: identity.value.version,
        idempotencyKey: `release:${releaseId}:${identity.value.version}`,
      });
      identity.value = released;
      await load();
      receipt.value =
        "已发布，产品与 SKU 身份已交给寻源侧（BOM 与 Listing 记为待补）";
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法发布可售 SKU";
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    queue,
    selected,
    waiting,
    drafted,
    identity,
    draft,
    releaseGaps,
    loading,
    saving,
    error,
    receipt,
    load,
    loadIdentity,
    addSku,
    removeSku,
    save,
    release,
  };
}
