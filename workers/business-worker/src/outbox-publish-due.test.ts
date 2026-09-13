import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublishDueRequest,
  classifyPublishDueHttpStatus,
  resolveLogixApiUrl,
} from "./outbox-publish-due";

describe("resolveLogixApiUrl", () => {
  it("默认本机 API，去掉尾斜杠，拒绝非 http(s)", () => {
    assert.equal(resolveLogixApiUrl(undefined), "http://localhost:3000");
    assert.equal(resolveLogixApiUrl("http://api.local/"), "http://api.local");
    assert.throws(
      () => resolveLogixApiUrl("ftp://api.local"),
      /VALIDATION_FORMAT/,
    );
  });
});

describe("buildPublishDueRequest", () => {
  it("只带开发期身份头与可选排空参数", () => {
    assert.deepEqual(
      buildPublishDueRequest(
        { tenantId: " t1 ", operatorId: " op-1 ", limit: 20, maxRounds: 3 },
        "http://localhost:3000",
      ),
      {
        url: "http://localhost:3000/api/outbox/publish-due",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": "t1",
          "x-operator-id": "op-1",
        },
        body: { limit: 20, maxRounds: 3 },
      },
    );
  });
});

describe("classifyPublishDueHttpStatus", () => {
  it("业务/鉴权拒绝不可重试，暂时故障可重试", () => {
    assert.equal(classifyPublishDueHttpStatus(422), "non_retryable");
    assert.equal(classifyPublishDueHttpStatus(401), "non_retryable");
    assert.equal(classifyPublishDueHttpStatus(403), "non_retryable");
    assert.equal(classifyPublishDueHttpStatus(429), "retryable");
    assert.equal(classifyPublishDueHttpStatus(503), "retryable");
  });
});
