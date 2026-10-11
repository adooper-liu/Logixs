import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { localModuleUrl, run } from "./generate-manifest.cli";

const runtimeRequire = createRequire(__filename);
const tsxCli = runtimeRequire.resolve("tsx/cli");

describe("manifest CLI safety boundary", () => {
  it.each([
    {
      argv: ["--execute"],
      code: "DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2",
    },
    {
      argv: ["--tenant", "other", "--output", "unused"],
      code: "DEMO_MAINTENANCE_TENANT_DENIED",
    },
    {
      argv: ["--tenant", "demo-real-sample-20260921"],
      code: "MANIFEST_OUTPUT_REQUIRED",
    },
  ])("rejects $code before client configuration", async ({ argv, code }) => {
    const createClients = vi.fn();

    await expect(run(argv, { createClients })).rejects.toThrow(code);
    expect(createClients).not.toHaveBeenCalled();
  });

  it("converts local absolute paths to ESM file URLs", () => {
    const absolute = path.resolve("scripts/full-chain-demo/manifest.mjs");
    expect(localModuleUrl(absolute)).toBe(pathToFileURL(absolute).href);
    expect(localModuleUrl(absolute)).toMatch(/^file:\/\//u);
  });

  it("loads through the explicit tsx CLI and rejects execute within five seconds", () => {
    const result = spawnSync(
      process.execPath,
      [
        tsxCli,
        path.resolve(__dirname, "generate-manifest.cli.ts"),
        "--execute",
      ],
      { encoding: "utf8", timeout: 5_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2",
    );
  });
});
