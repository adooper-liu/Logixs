import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublishDueSystemRequest,
  resolveServiceCredentials,
} from "./outbox-publish-due-system";

describe("resolveServiceCredentials", () => {
  it("本地默认开发凭据，空串拒绝", () => {
    assert.deepEqual(resolveServiceCredentials(undefined, undefined), {
      serviceId: "logix-outbox-publisher",
      serviceKey: "dev-service-key",
    });
    assert.throws(
      () => resolveServiceCredentials("  ", "key"),
      /VALIDATION_FORMAT/,
    );
  });
});

describe("buildPublishDueSystemRequest", () => {
  it("只带服务身份头，不含租户头", () => {
    const request = buildPublishDueSystemRequest(
      { limit: 20, maxRounds: 3, maxTenants: 10 },
      "http://localhost:3000",
      { serviceId: "svc-1", serviceKey: "key-1" },
    );
    assert.deepEqual(request, {
      url: "http://localhost:3000/api/outbox/system/publish-due",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-id": "svc-1",
        "x-service-key": "key-1",
      },
      body: { limit: 20, maxRounds: 3, maxTenants: 10 },
    });
    assert.equal(
      Object.prototype.hasOwnProperty.call(request.headers, "x-tenant-id"),
      false,
    );
  });
});
