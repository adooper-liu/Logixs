import type { NpiStageOutcomeV1 } from "@logix/contracts";

/** 齐=有结论且有依据；半=仅其一；缺=皆无。不伪造百分比。 */
export type NpiCompleteness = "complete" | "partial" | "missing";

export const NPI_STAGE_RAIL = [
  { code: "concept", label: "概念" },
  { code: "evt", label: "EVT" },
  { code: "dvt", label: "DVT" },
  { code: "pvt", label: "PVT" },
  { code: "mp", label: "MP" },
] as const;

export type NpiStageRailCode = (typeof NPI_STAGE_RAIL)[number]["code"];

export function npiCompleteness(
  outcome:
    Pick<NpiStageOutcomeV1, "conclusion" | "evidenceRefs"> | null | undefined,
): NpiCompleteness {
  const hasConclusion = Boolean(outcome?.conclusion?.trim());
  const hasEvidence = (outcome?.evidenceRefs?.length ?? 0) > 0;
  if (hasConclusion && hasEvidence) return "complete";
  if (hasConclusion || hasEvidence) return "partial";
  return "missing";
}

export function npiCompletenessLabel(value: NpiCompleteness): string {
  switch (value) {
    case "complete":
      return "齐";
    case "partial":
      return "半";
    case "missing":
      return "缺";
  }
}

/**
 * 轨上哪一段是当前。未领/无定义 → 概念；已有定义落在 evt…mp。
 */
export function currentRailStage(
  npiStage: "evt" | "dvt" | "pvt" | "mp" | null | undefined,
  claimed: boolean,
): NpiStageRailCode {
  if (!claimed || !npiStage) return "concept";
  return npiStage;
}

export function railStageState(
  code: NpiStageRailCode,
  current: NpiStageRailCode,
): "done" | "current" | "upcoming" {
  const order = NPI_STAGE_RAIL.map((item) => item.code);
  const codeIndex = order.indexOf(code);
  const currentIndex = order.indexOf(current);
  if (codeIndex < currentIndex) return "done";
  if (codeIndex === currentIndex) return "current";
  return "upcoming";
}
