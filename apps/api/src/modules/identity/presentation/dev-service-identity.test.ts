import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { attachDevServiceIdentity } from "./dev-service-identity";

const EXPECTED = { serviceId: "svc-1", serviceKey: "key-1" };

describe("attachDevServiceIdentity", () => {
  it("缺 header、空串或错凭据均拒绝", () => {
    expect(() => attachDevServiceIdentity({ headers: {} }, EXPECTED)).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      attachDevServiceIdentity(
        {
          headers: { "x-service-id": "svc-1", "x-service-key": "  " },
        },
        EXPECTED,
      ),
    ).toThrow("AUTHENTICATION_REQUIRED");
    expect(() =>
      attachDevServiceIdentity(
        {
          headers: { "x-service-id": "svc-1", "x-service-key": "wrong" },
        },
        EXPECTED,
      ),
    ).toThrow("AUTHENTICATION_REQUIRED");
    expect(() =>
      attachDevServiceIdentity(
        {
          headers: {
            "x-tenant-id": "t1",
            "x-operator-id": "op-1",
          },
        },
        EXPECTED,
      ),
    ).toThrow("AUTHENTICATION_REQUIRED");
  });

  it("匹配凭据写入 request.devServiceIdentity", () => {
    const request = {
      headers: { "x-service-id": " svc-1 ", "x-service-key": "key-1" },
    };
    expect(attachDevServiceIdentity(request, EXPECTED)).toEqual({
      actorType: "service",
      serviceId: "svc-1",
      actorId: "service:svc-1",
    });
    expect(request).toMatchObject({
      devServiceIdentity: {
        actorType: "service",
        actorId: "service:svc-1",
      },
    });
  });
});
