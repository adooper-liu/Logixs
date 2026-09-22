import type {
  LifecycleNodeCode,
  TaskCompletionEligibility,
  TaskReadinessState,
} from "@logix/contracts";
import type { TaskConditionFact } from "./task-condition-fact";

// Compatibility-only mapping for legacy facts that predate canonical event links.
// New facts carry nodeCode resolved from the canonical event catalog.
const FACT_TARGET_NODE: Readonly<Record<string, LifecycleNodeCode>> = {
  customs_clearance_completed: "customs_clearance",
  container_unloading_completed: "container_unloading",
  container_empty_confirmed: "empty_return",
  container_empty_estimated: "empty_return",
};

export interface TaskConditionDecision {
  readinessState: TaskReadinessState;
  completionEligibility: TaskCompletionEligibility;
  conditionFactRefs: string[];
}

function targetsNode(
  fact: TaskConditionFact,
  nodeCode: LifecycleNodeCode,
): boolean {
  if (fact.nodeCode) return fact.nodeCode === nodeCode;
  if (fact.eventCode !== null) return false;
  return FACT_TARGET_NODE[fact.factCode] === nodeCode;
}

export function evaluateTaskConditions(input: {
  nodeCode: LifecycleNodeCode;
  isCurrent: boolean;
  facts: readonly TaskConditionFact[];
}): TaskConditionDecision {
  const matched = input.facts.filter((fact) =>
    targetsNode(fact, input.nodeCode),
  );
  const completionFact = matched.some(
    (fact) =>
      fact.timeKind === "actual" &&
      fact.captureSource !== "system_derived" &&
      Boolean(fact.evidenceRef),
  );
  return {
    readinessState:
      input.isCurrent || matched.length > 0 ? "ready" : "waiting_conditions",
    completionEligibility: completionFact ? "eligible" : "awaiting_evidence",
    conditionFactRefs: matched.map((fact) => fact.id),
  };
}
