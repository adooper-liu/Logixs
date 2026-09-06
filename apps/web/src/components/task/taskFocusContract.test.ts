import { describe, expect, it } from "vitest";
import { createTaskSeed, type SubmissionView } from "../../data/sample";
import { buildTaskFocus } from "./taskFocusContract";

const idleSubmission: SubmissionView = { stage: "idle" };

describe("buildTaskFocus", () => {
  it("builds only applicable steps and points a pool task to claim first", () => {
    const task = createTaskSeed().find((item) => item.taskId === "task_1026")!;

    const focus = buildTaskFocus(task, idleSubmission);

    expect(focus.steps.map((step) => step.code)).toEqual([
      "claim",
      "preconditions",
      "inputs",
      "evidence",
      "submit",
      "sync",
    ]);
    expect(focus.currentCode).toBe("claim");
    expect(focus.attentionLabel).toBe("领取任务");
    expect(focus.steps.map((step) => step.state)).toEqual([
      "current",
      "done",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("advances attention as task inputs and evidence become ready", () => {
    const task = createTaskSeed().find((item) => item.taskId === "task_1026")!;
    task.assignment.assignee = "当前员工";
    task.requiredInputs.forEach((item) => (item.state = "ready"));

    expect(buildTaskFocus(task, idleSubmission).currentCode).toBe("evidence");

    task.evidenceRequirements
      .filter((item) => item.required)
      .forEach((item) => (item.state = "verified"));
    expect(buildTaskFocus(task, idleSubmission).currentCode).toBe("submit");

    const accepted: SubmissionView = { stage: "accepted" };
    const syncing = buildTaskFocus(task, accepted);
    expect(syncing.currentCode).toBe("sync");
    expect(syncing.steps.find((step) => step.code === "submit")?.state).toBe(
      "done",
    );
  });

  it("keeps a blocking condition visible and omits inapplicable inputs", () => {
    const task = createTaskSeed().find((item) => item.taskId === "task_1025")!;

    const focus = buildTaskFocus(task, idleSubmission);

    expect(focus.steps.map((step) => step.code)).toEqual([
      "preconditions",
      "evidence",
      "submit",
      "sync",
    ]);
    expect(focus.currentCode).toBe("preconditions");
    expect(focus.steps[0]).toMatchObject({ state: "blocked", label: "前置" });
    expect(focus.attentionLabel).toBe("处理海关放行");
  });

  it("names the unresolved item instead of repeating its requirement group", () => {
    const task = createTaskSeed().find((item) => item.taskId === "task_1027")!;

    const focus = buildTaskFocus(task, idleSubmission);

    expect(focus.currentCode).toBe("evidence");
    expect(focus.attentionLabel).toBe("完成采纳理由");
  });

  it("shows all steps complete only after the fact is committed", () => {
    const task = createTaskSeed().find((item) => item.taskId === "task_1026")!;
    task.assignment.assignee = "当前员工";
    task.requiredInputs.forEach((item) => (item.state = "ready"));
    task.evidenceRequirements
      .filter((item) => item.required)
      .forEach((item) => (item.state = "verified"));

    const focus = buildTaskFocus(task, { stage: "committed" });

    expect(focus.currentCode).toBe("sync");
    expect(focus.attentionLabel).toBe("闭环完成");
    expect(focus.steps.every((step) => step.state === "done")).toBe(true);
  });
});
