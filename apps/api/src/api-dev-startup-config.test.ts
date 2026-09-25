import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("API development startup configuration", () => {
  it("uses the build tsconfig so test fixtures cannot change the emitted entry path", async () => {
    const apiRoot = resolve(__dirname, "..");
    const nestConfig = JSON.parse(
      await readFile(resolve(apiRoot, "nest-cli.json"), "utf8"),
    ) as { compilerOptions?: { tsConfigPath?: string } };
    const buildConfig = JSON.parse(
      await readFile(resolve(apiRoot, "tsconfig.build.json"), "utf8"),
    ) as { exclude?: string[] };

    expect(nestConfig.compilerOptions?.tsConfigPath).toBe(
      "tsconfig.build.json",
    );
    expect(buildConfig.exclude).toContain("**/*.test.ts");
  });
});
