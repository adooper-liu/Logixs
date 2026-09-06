import type { SubmissionView, TaskItem } from "../../data/sample";

export type TaskFocusStepCode =
  "claim" | "preconditions" | "inputs" | "evidence" | "submit" | "sync";

export type TaskFocusStepState =
  "done" | "current" | "upcoming" | "waiting" | "blocked";

export interface TaskFocusStep {
  code: TaskFocusStepCode;
  label: string;
  state: TaskFocusStepState;
  progress?: string;
}

export interface TaskFocusView {
  steps: TaskFocusStep[];
  currentCode: TaskFocusStepCode;
  attentionLabel: string;
}

type RawStep = Omit<TaskFocusStep, "state"> & {
  state: Exclude<TaskFocusStepState, "current">;
};

const isSubmissionStarted = (stage: SubmissionView["stage"]) =>
  stage !== "idle";

export const buildTaskFocus = (
  task: TaskItem,
  submission: SubmissionView,
): TaskFocusView => {
  const steps: RawStep[] = [];

  if (task.assignment.mode === "pool") {
    steps.push({
      code: "claim",
      label: "领取",
      state: task.assignment.assignee ? "done" : "upcoming",
    });
  }

  if (task.preconditions.length) {
    const met = task.preconditions.filter(
      (item) => item.state === "met",
    ).length;
    const state = task.preconditions.some((item) => item.state === "blocked")
      ? "blocked"
      : met === task.preconditions.length
        ? "done"
        : "waiting";
    steps.push({
      code: "preconditions",
      label: "前置",
      state,
      progress: `${met}/${task.preconditions.length}`,
    });
  }

  if (task.requiredInputs.length) {
    const ready = task.requiredInputs.filter(
      (item) => item.state === "ready",
    ).length;
    const state = task.requiredInputs.some((item) => item.state === "missing")
      ? "blocked"
      : ready === task.requiredInputs.length
        ? "done"
        : "upcoming";
    steps.push({
      code: "inputs",
      label: "资料",
      state,
      progress: `${ready}/${task.requiredInputs.length}`,
    });
  }

  if (task.evidenceRequirements.length) {
    const required = task.evidenceRequirements.filter((item) => item.required);
    const verified = required.filter(
      (item) => item.state === "verified",
    ).length;
    const pendingRequired = required.filter(
      (item) => item.state !== "verified",
    );
    const state =
      verified === required.length
        ? "done"
        : pendingRequired.length > 0 &&
            pendingRequired.every((item) => item.state === "waiting")
          ? "waiting"
          : "upcoming";
    steps.push({
      code: "evidence",
      label: "证据",
      state,
      progress: `${verified}/${required.length}`,
    });
  }

  steps.push({
    code: "submit",
    label: "提交",
    state: isSubmissionStarted(submission.stage) ? "done" : "upcoming",
  });
  steps.push({
    code: "sync",
    label: "落账",
    state:
      submission.stage === "committed"
        ? "done"
        : submission.stage === "rejected"
          ? "blocked"
          : "upcoming",
  });

  const firstUnresolved = steps.findIndex((step) => step.state !== "done");
  const currentIndex =
    firstUnresolved === -1 ? steps.length - 1 : firstUnresolved;
  const current = steps[currentIndex];
  const resolvedSteps: TaskFocusStep[] = steps.map((step, index) => {
    if (firstUnresolved === -1 || step.state === "done") return step;
    if (index > currentIndex) return { ...step, state: "upcoming" };
    if (step.state === "blocked" || step.state === "waiting") return step;
    return { ...step, state: "current" };
  });

  const unresolvedCondition = task.preconditions.find(
    (item) => item.state !== "met",
  );
  const unresolvedInput = task.requiredInputs.find(
    (item) => item.state !== "ready",
  );
  const unresolvedEvidence = task.evidenceRequirements.find(
    (item) => item.required && item.state !== "verified",
  );
  const attentionLabel = (() => {
    if (firstUnresolved === -1) return "闭环完成";
    if (current.code === "claim") return "领取任务";
    if (current.code === "sync") return "等待业务落账";
    if (current.code === "submit") return "提交业务结果";
    if (current.code === "preconditions" && unresolvedCondition) {
      return current.state === "waiting"
        ? `等待${unresolvedCondition.label}`
        : `处理${unresolvedCondition.label}`;
    }
    if (current.code === "inputs" && unresolvedInput) {
      return `确认${unresolvedInput.label}`;
    }
    if (current.code === "evidence" && unresolvedEvidence) {
      return unresolvedEvidence.state === "waiting"
        ? `等待${unresolvedEvidence.label}`
        : `完成${unresolvedEvidence.label}`;
    }
    return current.state === "waiting"
      ? `等待${current.label}`
      : `完成${current.label}`;
  })();

  return {
    steps: resolvedSteps,
    currentCode: current.code,
    attentionLabel,
  };
};
