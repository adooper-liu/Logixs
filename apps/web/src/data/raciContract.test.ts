import { describe, expect, it } from "vitest";
import { raciRoleDefinitions } from "./raciContract";
import { raciRows, railDefinitions } from "./sample";

describe("RACI management projection", () => {
  it("covers the 14 rail nodes and eight roles with one accountable role each", () => {
    expect(raciRoleDefinitions).toHaveLength(8);
    expect(raciRows.map((row) => row.nodeKey)).toEqual(
      railDefinitions.map(([key]) => key),
    );

    const knownRoles = new Set(raciRoleDefinitions.map((role) => role.key));
    for (const row of raciRows) {
      expect(row.cells.filter((cell) => cell.code === "A")).toHaveLength(1);
      expect(new Set(row.cells.map((cell) => cell.role)).size).toBe(
        row.cells.length,
      );
      expect(row.cells.every((cell) => knownRoles.has(cell.role))).toBe(true);
      expect(
        row.cells.every((cell) => ["R", "A", "C", "I"].includes(cell.code)),
      ).toBe(true);
    }
  });
});
