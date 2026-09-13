import { describe, expect, it } from "vitest";
import { parseContainerIds } from "./lifecycle-current-nodes";

describe("parseContainerIds", () => {
  it("去空白和重复，拒绝空列表和超额", () => {
    expect(parseContainerIds(" c1, c1,c2 ")).toEqual(["c1", "c2"]);
    expect(() => parseContainerIds("")).toThrow("VALIDATION_REQUIRED");
    expect(() => parseContainerIds("  ,  ")).toThrow("VALIDATION_REQUIRED");
    expect(() =>
      parseContainerIds(
        Array.from({ length: 201 }, (_, i) => `c${i}`).join(","),
      ),
    ).toThrow("VALIDATION_RANGE");
  });
});
