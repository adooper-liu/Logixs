import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { attachDevIdentity } from "./dev-identity";

describe("attachDevIdentity", () => {
  it("缺 header 或空串拒绝", () => {
    expect(() => attachDevIdentity({ headers: {} })).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      attachDevIdentity({
        headers: { "x-tenant-id": "t1", "x-operator-id": "  " },
      }),
    ).toThrow("AUTHENTICATION_REQUIRED");
  });

  it("双 header 写入统一的 request.identity", () => {
    const request = {
      headers: { "x-tenant-id": " t1 ", "x-operator-id": "op1" },
    };
    expect(attachDevIdentity(request)).toEqual({
      actorType: "user",
      actorId: "op1",
      tenantId: "t1",
      authenticationMethod: "development_headers",
    });
    expect(request).toMatchObject({
      identity: {
        actorType: "user",
        actorId: "op1",
        tenantId: "t1",
        authenticationMethod: "development_headers",
      },
    });
  });
});
