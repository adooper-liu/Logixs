import { describe, expect, it } from "vitest";
import { parseMaxTenants, sliceDueTenants } from "./outbox-system-drain";

describe("parseMaxTenants", () => {
  it("默认 20，拒绝越界与非整数", () => {
    expect(parseMaxTenants(undefined)).toBe(20);
    expect(parseMaxTenants("10")).toBe(10);
    expect(() => parseMaxTenants("0")).toThrow("VALIDATION_FORMAT");
    expect(() => parseMaxTenants("101")).toThrow("VALIDATION_FORMAT");
    expect(() => parseMaxTenants("1.5")).toThrow("VALIDATION_FORMAT");
  });
});

describe("sliceDueTenants", () => {
  it("截断并标记是否还有未处理租户", () => {
    expect(sliceDueTenants(["t1", "t2"], 2)).toEqual({
      tenantIds: ["t1", "t2"],
      leftoverTenants: false,
    });
    expect(sliceDueTenants(["t1", "t2", "t3"], 2)).toEqual({
      tenantIds: ["t1", "t2"],
      leftoverTenants: true,
    });
  });
});
