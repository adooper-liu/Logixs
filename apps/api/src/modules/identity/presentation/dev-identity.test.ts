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
      roles: [],
      capabilities: [],
    });
    expect(request).toMatchObject({
      identity: {
        actorType: "user",
        actorId: "op1",
        tenantId: "t1",
        authenticationMethod: "development_headers",
        roles: [],
        capabilities: [],
      },
    });
  });

  it("从 x-roles 推导能力，或接受 x-capabilities 显式覆盖", () => {
    expect(
      attachDevIdentity({
        headers: {
          "x-tenant-id": "t1",
          "x-operator-id": "op1",
          "x-roles": "operations_dispatcher",
        },
      }).capabilities,
    ).toContain("planning.draft");

    expect(
      attachDevIdentity({
        headers: {
          "x-tenant-id": "t1",
          "x-operator-id": "op1",
          "x-roles": "operations_dispatcher",
          "x-capabilities": "planning.read",
        },
      }),
    ).toMatchObject({
      roles: ["operations_dispatcher"],
      capabilities: ["planning.read"],
    });
  });
});
