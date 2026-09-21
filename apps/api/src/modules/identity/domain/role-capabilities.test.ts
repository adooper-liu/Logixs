import { describe, expect, it } from "vitest";
import { capabilitiesForRoles, hasAllCapabilities } from "./role-capabilities";

describe("role-capabilities", () => {
  it("maps operations_dispatcher to planning.draft", () => {
    expect(capabilitiesForRoles(["operations_dispatcher"])).toContain(
      "planning.draft",
    );
  });

  it("keeps compliance review separate from operational read access", () => {
    expect(capabilitiesForRoles(["operations_dispatcher"])).toContain(
      "compliance.read",
    );
    expect(capabilitiesForRoles(["operations_dispatcher"])).not.toContain(
      "compliance.review",
    );
    expect(capabilitiesForRoles(["review_supervisor"])).toContain(
      "compliance.review",
    );
  });

  it("unions capabilities across roles and ignores unknown roles", () => {
    const caps = capabilitiesForRoles([
      "field_operator",
      "unknown_role",
      "import_operator",
    ]);
    expect(caps).toContain("task.execute");
    expect(caps).toContain("import.execute");
    expect(caps).not.toContain("identity.manage");
  });

  it("requires every listed capability", () => {
    expect(hasAllCapabilities(["planning.read"], ["planning.read"])).toBe(true);
    expect(
      hasAllCapabilities(
        ["planning.read"],
        ["planning.read", "planning.draft"],
      ),
    ).toBe(false);
  });
});
