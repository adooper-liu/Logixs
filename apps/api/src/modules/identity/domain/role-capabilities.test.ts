import { describe, expect, it } from "vitest";
import { capabilitiesForRoles, hasAllCapabilities } from "./role-capabilities";

describe("role-capabilities", () => {
  it("maps operations_dispatcher to planning.draft", () => {
    expect(capabilitiesForRoles(["operations_dispatcher"])).toContain(
      "planning.draft",
    );
  });

  it("grants controlled container fact writes to operational roles", () => {
    expect(capabilitiesForRoles(["field_operator"])).toContain(
      "container.operate",
    );
    expect(capabilitiesForRoles(["operations_dispatcher"])).toContain(
      "container.operate",
    );
    expect(capabilitiesForRoles(["manager"])).not.toContain(
      "container.operate",
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

  it("grants personal work session management without granting domain writes", () => {
    for (const role of [
      "operations_dispatcher",
      "review_supervisor",
      "manager",
      "business_admin",
      "audit_analyst",
    ]) {
      expect(capabilitiesForRoles([role])).toContain("work_session.manage");
    }
    expect(capabilitiesForRoles(["manager"])).not.toContain("planning.draft");
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

  it("grants task collaboration only to the four approved role packs", () => {
    for (const role of [
      "field_operator",
      "operations_dispatcher",
      "review_supervisor",
      "manager",
    ]) {
      expect(capabilitiesForRoles([role])).toContain("task.collaborate");
    }

    for (const role of [
      "audit_analyst",
      "business_admin",
      "finance_controller",
      "import_operator",
      "unknown_role",
    ]) {
      expect(capabilitiesForRoles([role])).not.toContain("task.collaborate");
    }
  });
});
