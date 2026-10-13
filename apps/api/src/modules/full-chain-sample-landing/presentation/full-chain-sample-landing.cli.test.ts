import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "./full-chain-sample-landing.cli";

const fetchMock = vi.fn();
const readPackage = vi.fn(async () => ({ manifest: {}, records: [] }));
const output = vi.fn();
const repositoryRoot = process.cwd();

afterEach(() => {
  vi.clearAllMocks();
});

function deps(overrides: Record<string, unknown> = {}) {
  return {
    fetch: fetchMock,
    readPackage,
    output,
    repositoryRoot,
    env: { FULL_CHAIN_LANDING_TOKEN: "token" },
    ...overrides,
  } as never;
}

function args(packagePath: string, approvedRoot: string) {
  return [
    "--package",
    packagePath,
    "--approved-root",
    approvedRoot,
    "--api-url",
    "https://example.test",
    "--idempotency-key",
    "request-1",
  ];
}

describe("full-chain landing CLI", () => {
  it.each([
    { argv: [] },
    { argv: ["--package", "x"] },
    { argv: ["--package", "x", "--approved-root", "y"] },
  ])(
    "rejects missing arguments before package or network I/O",
    async ({ argv }) => {
      await expect(run(argv, deps())).rejects.toThrow(
        /FULL_CHAIN_CLI_ARGUMENTS_INVALID/,
      );
      expect(readPackage).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing token before package or network I/O", async () => {
    await expect(
      run(args("C:/external/package", "C:/external"), deps({ env: {} })),
    ).rejects.toThrow(/FULL_CHAIN_CLI_TOKEN_REQUIRED/);
    expect(readPackage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS remote URLs before package or network I/O", async () => {
    const argv = args("C:/external/package", "C:/external");
    argv[argv.indexOf("https://example.test")] = "http://remote.test";
    await expect(run(argv, deps())).rejects.toThrow(
      /FULL_CHAIN_CLI_API_URL_INVALID/,
    );
    expect(readPackage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("delegates path and package validation before fetch", async () => {
    readPackage.mockRejectedValueOnce(new Error("PACKAGE_PATH_INVALID"));
    await expect(
      run(args("C:/external/package", "C:/external"), deps()),
    ).rejects.toThrow(/PACKAGE_PATH_INVALID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts one validated package and emits only the redacted result", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "landing-cli-"));
    const packagePath = path.join(root, "package");
    await mkdir(packagePath);
    try {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runId: "run-1",
          state: "published",
          counts: { shipment_plan: 1 },
          gapCount: 0,
          ignoredSecret: "must-not-print",
        }),
      });
      await run(args(packagePath, root), deps());
      expect(readPackage).toHaveBeenCalledWith({
        packagePath,
        approvedRoot: root,
        repositoryRoot,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(output).toHaveBeenCalledWith(
        JSON.stringify({
          runId: "run-1",
          state: "published",
          counts: { shipment_plan: 1 },
          gapCount: 0,
        }),
      );
      expect(output.mock.calls.flat().join(" ")).not.toContain(
        "must-not-print",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
