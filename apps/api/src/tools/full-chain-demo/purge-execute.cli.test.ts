import { describe, expect, it, vi } from "vitest";
import { parseExecutionArguments, run } from "./purge-execute.cli";

describe("purge execute CLI boundary", () => {
  it("accepts only the exact target tenant with explicit execute confirmation", () => {
    expect(
      parseExecutionArguments([
        "--execute",
        "--tenant",
        "demo-real-sample-20260921",
        "--manifest",
        "manifest.json",
        "--expected-manifest-hash",
        "a".repeat(64),
        "--confirm-delete",
        "demo-real-sample-20260921",
      ]),
    ).toEqual({
      tenant: "demo-real-sample-20260921",
      manifestPath: "manifest.json",
      expectedHash: "a".repeat(64),
    });
  });

  it.each([
    {
      argv: ["--tenant", "demo-real-sample-20260921"],
      code: "DEMO_PURGE_EXECUTE_REQUIRED",
    },
    {
      argv: ["--execute", "--tenant", "other"],
      code: "DEMO_MAINTENANCE_TENANT_DENIED",
    },
    {
      argv: [
        "--execute",
        "--tenant",
        "demo-real-sample-20260921",
        "--confirm-delete",
        "other",
      ],
      code: "DEMO_PURGE_CONFIRMATION_REQUIRED",
    },
  ])("rejects $code before client creation", async ({ argv, code }) => {
    const createClient = vi.fn();

    await expect(run(argv, { createClient })).rejects.toThrow(code);
    expect(createClient).not.toHaveBeenCalled();
  });
});
