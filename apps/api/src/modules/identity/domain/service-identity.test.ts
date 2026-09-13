import { describe, expect, it } from "vitest";
import { serviceActorId, serviceCredentialsMatch } from "./service-identity";

describe("serviceActorId", () => {
  it("生成 service: 前缀，拒绝空 id", () => {
    expect(serviceActorId(" logix-outbox-publisher ")).toBe(
      "service:logix-outbox-publisher",
    );
    expect(() => serviceActorId("  ")).toThrow("VALIDATION_FORMAT");
  });
});

describe("serviceCredentialsMatch", () => {
  it("同 id 同 key 才通过，错 key 或错 id 均失败", () => {
    const expected = { serviceId: "svc-1", serviceKey: "key-1" };
    expect(serviceCredentialsMatch(expected, expected)).toBe(true);
    expect(
      serviceCredentialsMatch(
        { serviceId: "svc-1", serviceKey: "key-2" },
        expected,
      ),
    ).toBe(false);
    expect(
      serviceCredentialsMatch(
        { serviceId: "svc-2", serviceKey: "key-1" },
        expected,
      ),
    ).toBe(false);
  });
});
