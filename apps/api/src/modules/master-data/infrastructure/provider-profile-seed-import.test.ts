import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Exercise the same root tsx configuration as db:seed without running database writes.
describe("provider profile seed import", () => {
  it("loads the seed dependency graph without the API decorator configuration", () => {
    const root = resolve(__dirname, "../../../../../..");
    const env = { ...process.env };
    delete env.TSX_TSCONFIG_PATH;
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        'await import("./database/seeds/seed-external-ocean-reference-mappings.ts"); console.log("SEED_IMPORT_OK");',
      ],
      { cwd: root, env, encoding: "utf8", stdio: "pipe" },
    );
    expect(output.trim()).toBe("SEED_IMPORT_OK");
  });
});
