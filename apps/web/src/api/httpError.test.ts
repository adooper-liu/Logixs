import { describe, expect, it } from "vitest";
import {
  formatHttpError,
  parseHttpErrorDetail,
  parseHttpErrorResponse,
} from "./httpError";

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

  it("读取 GC-011 嵌套 message 而不把完整信封显示给用户", () => {
    const body = JSON.stringify({
      success: false,
      error: {
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "当前没有可建议的领取动作。",
        category: "precondition",
        retryable: false,
        details: [
          { reasonCode: "NO_CLAIM_ACTION", message: "当前无领取动作。" },
        ],
      },
      traceId: "server-trace",
      timestamp: "2026-10-20T00:00:00.000Z",
    });

    expect(parseHttpErrorDetail(body)).toBe("当前没有可建议的领取动作。");
    expect(formatHttpError(409, body, "生成失败")).toBe(
      "生成失败（409）：当前没有可建议的领取动作。",
    );
    expect(parseHttpErrorResponse(body)).toMatchObject({
      category: "precondition",
      retryable: false,
    });
  });

  it("rejects unregistered category and non-boolean retryability", () => {
    expect(
      parseHttpErrorResponse(
        JSON.stringify({
          error: {
            code: "DEPENDENCY_RESPONSE_INVALID",
            message: "invalid dependency payload",
            category: "vendor_specific",
            retryable: "false",
            details: [],
          },
        }),
      ),
    ).toMatchObject({ category: null, retryable: null });
  });
});
