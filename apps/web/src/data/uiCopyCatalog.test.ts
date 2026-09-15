import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_NODE_CODES,
  NODE_CODE_LABELS,
  NODE_PURPOSE_LABELS,
  nodePurposeName,
  nodeScreenName,
  taskStatusCopy,
  uiCopy,
  uiCopyByLocale,
  UI_COPY_LOCALE,
} from "./uiCopyCatalog";

describe("uiCopyCatalog", () => {
  it("当前语言是 zh-CN，且词条非空", () => {
    expect(UI_COPY_LOCALE).toBe("zh-CN");
    expect(uiCopyByLocale["zh-CN"]).toBe(uiCopy);
    expect(uiCopy.action.claim).toBe("领取");
    expect(uiCopy.action.complete).toBe("完成工单");
    expect(uiCopy.outcome.committed).toBe("已入账");
    expect(uiCopy.taskStatus.available).toBe("待领取");
    expect(uiCopy.error.evidenceRequired).toContain("缺少合格证据");
  });

  it("十四站进行中用目录名，完成后加完成", () => {
    expect(LIFECYCLE_NODE_CODES).toHaveLength(14);
    expect(nodeScreenName("container_stuffing")).toBe("装箱");
    expect(nodePurposeName("container_stuffing")).toBe("装箱完成");
    expect(NODE_CODE_LABELS.container_pickup).toBe("提柜");
    expect(NODE_PURPOSE_LABELS.destination_arrival).toBe("到港完成");
    expect(nodeScreenName("unknown_node")).toBe("unknown_node");
  });

  it("任务状态短标签不从文案反推码", () => {
    expect(taskStatusCopy("in_progress")).toEqual({
      label: "进行中",
      tone: "info",
    });
    expect(taskStatusCopy("blocked").label).toBe("受阻");
  });
});
