import type { ProductOpportunityV1 } from "@logix/contracts";
import {
  computed,
  onMounted,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import {
  intakeProductOpportunity,
  listProductOpportunities,
  registerMarketSignalEvidence,
} from "../api/marketSignals";
import {
  productEvaluationContextFor,
  productEvaluationRequirements,
  type ProductEvaluationEvidenceDraft,
  type ProductEvaluationRequirementSet,
} from "../data/productEvaluationRequirements";

export function useProductOpportunityWorkbench(options: {
  selectedId: MaybeRefOrGetter<string>;
  selectOpportunity: (id: string) => Promise<void>;
}) {
  const items = shallowRef<ProductOpportunityV1[]>([]);
  const loading = shallowRef(true);
  const saving = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const receipt = shallowRef<string | null>(null);
  const selected = computed(
    () =>
      items.value.find(
        ({ handoff }) => handoff.handoffId === toValue(options.selectedId),
      ) ??
      items.value[0] ??
      null,
  );
  // 专业要求由适用规则在选定商品范围或进入评估动作后生成。
  // withheld 说明"缺什么才能生成"，把"不适用"和"还判断不了"分开。
  const requirements = computed<ProductEvaluationRequirementSet>(() =>
    selected.value
      ? productEvaluationRequirements(
          productEvaluationContextFor(selected.value),
        )
      : { requirements: [], withheld: [] },
  );

  onMounted(load);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = (await listProductOpportunities()).items;
      const requested = toValue(options.selectedId);
      const initial =
        items.value.find(({ handoff }) => handoff.handoffId === requested) ??
        items.value[0];
      if (initial && initial.handoff.handoffId !== requested) {
        await options.selectOpportunity(initial.handoff.handoffId);
      }
    } catch (caught) {
      error.value = message(caught);
      items.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function act(action: "claim" | "accept"): Promise<void> {
    const current = selected.value;
    if (!current || saving.value) return;
    saving.value = true;
    error.value = null;
    receipt.value = null;
    try {
      const updated = await intakeProductOpportunity(
        current.handoff.handoffId,
        {
          contractVersion: "product-opportunity-intake.v1",
          action,
          expectedIntakeVersion: current.intakeVersion,
          idempotencyKey: `product-opportunity-${action}:${current.handoff.handoffId}:${current.intakeVersion}:${crypto.randomUUID()}`,
        },
      );
      items.value = items.value.map((item) =>
        item.handoff.handoffId === updated.handoff.handoffId ? updated : item,
      );
      receipt.value =
        action === "claim"
          ? "已领取，当前机会已由你负责。"
          : "已接受经营机会，下一步进入立项判断。";
    } catch (caught) {
      error.value = message(caught);
      await load();
    } finally {
      saving.value = false;
    }
  }

  async function addEvidence(
    draft: ProductEvaluationEvidenceDraft,
  ): Promise<boolean> {
    const current = selected.value;
    const content = draft.content.trim();
    if (!current || saving.value || !content) return false;
    saving.value = true;
    error.value = null;
    receipt.value = null;
    try {
      await registerMarketSignalEvidence({
        signalId: current.handoff.signalId,
        sourceName: draft.sourceName.trim() || current.handoff.title,
        sourceUrl: draft.sourceUrl.trim(),
        content,
      });
      receipt.value =
        "已把新增证据登记到来源信号；该证据属于来源事实，供本项目评估继续核对。";
      return true;
    } catch (caught) {
      error.value = message(caught);
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    items,
    selected,
    requirements,
    loading,
    saving,
    error,
    receipt,
    load,
    claim: () => act("claim"),
    accept: () => act("accept"),
    addEvidence,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
