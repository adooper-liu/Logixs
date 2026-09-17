import type {
  LifecycleNodeCode,
  TaskCompletionEligibility,
  TaskReadinessState,
} from "@logix/contracts";
import type { TaskConditionFact } from "./task-condition-fact";

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

export function evaluateTaskConditions(input: {
  nodeCode: LifecycleNodeCode;
  isCurrent: boolean;
  facts: readonly TaskConditionFact[];
}): TaskConditionDecision {
  const matched = input.facts.filter(
    (fact) => FACT_TARGET_NODE[fact.factCode] === input.nodeCode,
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
