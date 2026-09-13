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

  it("双 header 写入 request.devIdentity", () => {
    const request = {
      headers: { "x-tenant-id": " t1 ", "x-operator-id": "op1" },
    };
    expect(attachDevIdentity(request)).toEqual({
      tenantId: "t1",
      operatorId: "op1",
    });
    expect(request).toMatchObject({
      devIdentity: { tenantId: "t1", operatorId: "op1" },
    });
  });
});
