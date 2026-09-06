import { describe, expect, it } from "vitest";
import { createTaskSeed, type SubmissionView } from "../../data/sample";
import { projectTaskLanguage } from "./taskLanguageContract";

const getTask = (taskId: string) => {
  const task = createTaskSeed().find(
    (candidate) => candidate.taskId === taskId,
  );
  expect(task).toBeDefined();
  return task!;
};

describe("projectTaskLanguage", () => {
  it("projects active work from a versioned definition and instance reason", () => {
    const language = projectTaskLanguage(getTask("task_1027"));

    expect(language).toEqual(
      expect.objectContaining({
        title: "确认实际离港时间",
        statusLabel: "待复核",
        tone: "risk",
        triggerReason: "船司与码头离港记录相差 45 分钟",
        showTriggerReason: true,
        guidanceLabel: "下一步",
        guidance: "核对两条离港记录，选择采用时间并填写理由。",
        completionCriteria: "采用时间、来源和理由形成对账结论。",
        guardrail: "如需修正已入账时间，系统新增更正记录并保留原记录。",
      }),
    );
  });

  it("replaces instructions with the committed result after completion", () => {
    const task = getTask("task_1027");
    task.status = "completed";
    const submission: SubmissionView = {
      taskId: task.taskId,
      stage: "committed",
      resultSummary: "已采用码头离港记录 08-18 15:05，原记录已保留。",
    };

    const language = projectTaskLanguage(task, submission);

    expect(language.statusLabel).toBe("已完成");
    expect(language.tone).toBe("ok");
    expect(language.showTriggerReason).toBe(false);
    expect(language.guidanceLabel).toBe("完成结果");
    expect(language.guidance).toBe(
      "已采用码头离港记录 08-18 15:05，原记录已保留。",
    );
    expect(language.guidance).not.toContain("核对");
  });

  it("states the waiting object and release condition for blocked work", () => {
    const language = projectTaskLanguage(getTask("task_1025"));

    expect(language.statusLabel).toBe("已阻塞");
    expect(language.tone).toBe("risk");
    expect(language.guidanceLabel).toBe("当前等待");
    expect(language.guidance).toBe("等待海关放行；条件齐全后才能安排派拖。");
    expect(language.guardrail).toBe("可以派拖不代表已经提柜。");
  });

  it("does not present a rejected operation as the completed result", () => {
    const task = getTask("task_1027");
    task.status = "completed";

    const language = projectTaskLanguage(task, {
      taskId: task.taskId,
      stage: "rejected",
      resultSummary: "这条结果未落账",
    });

    expect(language.guidance).toBe("离港时间对账结论已落账，原记录已保留。");
    expect(language.guidance).not.toContain("未落账");
  });

  it("fails explicitly for an unknown definition version", () => {
    const task = getTask("task_1027");
    task.taskDefinitionVersion = 99;

    expect(() => projectTaskLanguage(task)).toThrowError(
      "未知任务语言定义：resolve_departure_conflict@99",
    );
  });
});
