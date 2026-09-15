import { describe, expect, it } from "vitest";
import { formatHttpError, parseHttpErrorDetail } from "./httpError";

describe("httpError", () => {
  it("抽出 Nest JSON 里的业务说明，不把整段信封甩到屏幕", () => {
    expect(
      parseHttpErrorDetail(
        '{"statusCode":422,"message":"EVIDENCE_REQUIRED: 缺少合格证据"}',
      ),
    ).toBe("EVIDENCE_REQUIRED: 缺少合格证据");
    expect(
      formatHttpError(
        422,
        '{"statusCode":422,"message":"EVIDENCE_REQUIRED: 缺少合格证据"}',
        "完成工单失败",
      ),
    ).toBe("完成工单失败（422）：EVIDENCE_REQUIRED: 缺少合格证据");
  });

  it("数组 message 与纯文本原文都能读", () => {
    expect(parseHttpErrorDetail('{"statusCode":400,"message":["a","b"]}')).toBe(
      "a；b",
    );
    expect(parseHttpErrorDetail("RESOURCE_NOT_FOUND")).toBe(
      "RESOURCE_NOT_FOUND",
    );
  });
});
