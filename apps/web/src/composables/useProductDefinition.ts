import {
  computed,
  reactive,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import type {
  ProductDefinitionReleaseCommandV1,
  ProductDefinitionV1,
} from "@logix/contracts";
import {
  getProductDefinition,
  releaseProductDefinition,
  writeProductDefinition,
} from "../api/marketSignals";

/** 阶段名与行业说法并列：界面上写中文，括号里给人对照代工厂的说法。 */
export const NPI_STAGES = [
  {
    code: "evt",
    label: "工程验证（EVT）",
    hint: "用接近最终的物料验证功能，同时看关键料供得上",
  },
  {
    code: "dvt",
    label: "设计验证（DVT）",
    hint: "设计冻结、开模投入，合规风险要盘清",
  },
  {
    code: "pvt",
    label: "生产验证（PVT）",
    hint: "第一次真的跑量产，看可行性与良率",
  },
  { code: "mp", label: "量产（MP）", hint: "可以发布了" },
] as const;

export type NpiStageCode = (typeof NPI_STAGES)[number]["code"];

export function stageLabel(code: NpiStageCode): string {
  return NPI_STAGES.find((stage) => stage.code === code)?.label ?? code;
}

/**
 * 缺口逐项说清"在哪补"。**这一条是有教训的**：选品立项那边就是因为一句话把
 * 全部缺口指向同一个面板，人照着去找却找不到，只剩按钮上一句"还差 N 项"。
 */
export const PENDING_FIELD_HINTS: Record<string, string> = {
  specification: "在「产品规格」里写",
  compliance_assumptions: "在「合规假设」里至少写一条",
  evt_conclusion: "在本阶段结论里写",
  dvt_conclusion: "在本阶段结论里写",
  pvt_conclusion: "在本阶段结论里写",
};

export interface ProductDefinitionDraft {
  specification: string;
  complianceAssumptions: string[];
  conclusion: string;
}

export function useProductDefinition(options: {
  initiativeHandoffId: MaybeRefOrGetter<string>;
  /** 只有领取人本人能推进；不是本人时面板只读。 */
  mine: MaybeRefOrGetter<boolean>;
}) {
  const definition = shallowRef<ProductDefinitionV1 | null>(null);
  const draft = reactive<ProductDefinitionDraft>({
    specification: "",
    complianceAssumptions: [],
    conclusion: "",
  });
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef("");
  const receipt = shallowRef("");

  const stage = computed<NpiStageCode>(
    () => (definition.value?.npiStage ?? "evt") as NpiStageCode,
  );
  const nextStage = computed<NpiStageCode | null>(() => {
    const index = NPI_STAGES.findIndex((item) => item.code === stage.value);
    return NPI_STAGES[index + 1]?.code ?? null;
  });
  /** 本阶段是否已登记结论 —— 没登记就前进不了，界面先说清。 */
  const currentStageConcluded = computed(() =>
    (definition.value?.stageOutcomes ?? []).some(
      (outcome) => outcome.stage === stage.value,
    ),
  );
  const pendingFields = computed(() =>
    (definition.value?.pendingFieldCodes ?? []).map((code) => ({
      code,
      hint: PENDING_FIELD_HINTS[code] ?? "按当前阶段补齐",
    })),
  );
  const released = computed(
    () =>
      definition.value !== null &&
      definition.value.releaseState !== "in_progress",
  );

  let loadToken = 0;
  watch(
    () => toValue(options.initiativeHandoffId),
    () => void load(),
    { immediate: true },
  );

  async function load(): Promise<void> {
    const handoffId = toValue(options.initiativeHandoffId);
    const token = ++loadToken;
    if (!handoffId) {
      definition.value = null;
      reset();
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const loaded = await getProductDefinition(handoffId);
      // 只允许最后一次请求写结果：连点两条待办很常见，先发的后返回会盖掉后选的。
      if (token !== loadToken) return;
      definition.value = loaded;
      draft.specification = loaded?.specification ?? "";
      draft.complianceAssumptions = [...(loaded?.complianceAssumptions ?? [])];
      draft.conclusion = "";
    } catch (failure) {
      if (token !== loadToken) return;
      error.value =
        failure instanceof Error ? failure.message : "暂时无法加载产品定义";
    } finally {
      if (token === loadToken) loading.value = false;
    }
  }

  function reset(): void {
    draft.specification = "";
    draft.complianceAssumptions = [];
    draft.conclusion = "";
  }

  /** 保存一版；`advanceStage` 为真时同时前进一段。 */
  async function save(advanceStage: boolean): Promise<boolean> {
    const handoffId = toValue(options.initiativeHandoffId);
    if (!handoffId) return false;
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      const saved = await writeProductDefinition(handoffId, {
        contractVersion: "product-definition-write.v1",
        expectedDefinitionVersion: definition.value?.version ?? 0,
        specification: draft.specification.trim(),
        complianceAssumptions: draft.complianceAssumptions
          .map((value) => value.trim())
          .filter(Boolean),
        ...(draft.conclusion.trim()
          ? {
              conclusion: {
                text: draft.conclusion.trim(),
                evidenceRefs: [],
              },
            }
          : {}),
        advanceStage,
        idempotencyKey: `write:${handoffId}:${definition.value?.version ?? 0}`,
      });
      definition.value = saved;
      draft.specification = saved.specification;
      draft.complianceAssumptions = [...saved.complianceAssumptions];
      draft.conclusion = "";
      receipt.value = advanceStage
        ? `已前进到${stageLabel(saved.npiStage as NpiStageCode)}`
        : "已保存";
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法保存产品定义";
      return false;
    } finally {
      saving.value = false;
    }
  }

  /** 发布决定。发布才产生交接；暂缓与终止必须说明原因（服务端也这么要求）。 */
  async function release(
    decision: ProductDefinitionReleaseCommandV1["decision"],
    reason = "",
  ): Promise<boolean> {
    const handoffId = toValue(options.initiativeHandoffId);
    if (!handoffId || !definition.value) return false;
    saving.value = true;
    error.value = "";
    receipt.value = "";
    try {
      const decided = await releaseProductDefinition(handoffId, {
        contractVersion: "product-definition-release.v1",
        expectedDefinitionVersion: definition.value.version,
        decision,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        idempotencyKey: `release:${handoffId}:${decision}:${
          definition.value.version
        }`,
      });
      definition.value = decided;
      receipt.value =
        decision === "release"
          ? "已发布，产品设计已交给主数据侧"
          : decision === "defer"
            ? "已暂缓"
            : "已终止";
      return true;
    } catch (failure) {
      error.value =
        failure instanceof Error ? failure.message : "暂时无法保存这个决定";
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    definition,
    draft,
    stage,
    nextStage,
    currentStageConcluded,
    pendingFields,
    released,
    loading,
    saving,
    error,
    receipt,
    load,
    save,
    release,
  };
}
