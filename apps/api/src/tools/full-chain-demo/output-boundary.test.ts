import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertExternalArtifactFile,
  prepareNewExternalOutput,
  revalidateExternalStaging,
} from "./output-boundary";

const temporaryDirectories: string[] = [];

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "output-boundary-test-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("external artifact output boundary", () => {
  it("allows only a new strict descendant of the approved external root", async () => {
    const root = await temporaryRoot();
    const repositoryRoot = path.join(root, "repository");
    const approvedRoot = path.join(root, "evidence");
    await mkdir(repositoryRoot);
    await mkdir(approvedRoot);

    await expect(
      prepareNewExternalOutput({
        outputPath: path.join(approvedRoot, "nested", "run-1"),
        repositoryRoot,
        approvedRoot,
      }),
    ).resolves.toMatchObject({
      outputPath: path.join(approvedRoot, "nested", "run-1"),
    });
    await expect(
      prepareNewExternalOutput({
        outputPath: approvedRoot,
        repositoryRoot,
        approvedRoot,
      }),
    ).rejects.toThrow("OUTPUT_MUST_BE_EXTERNAL");
    await expect(
      prepareNewExternalOutput({
        outputPath: path.join(repositoryRoot, "manifest"),
        repositoryRoot,
        approvedRoot,
      }),
    ).rejects.toThrow("OUTPUT_MUST_BE_EXTERNAL");
    await expect(
      prepareNewExternalOutput({
        outputPath: path.join(approvedRoot, "..", "escape"),
        repositoryRoot,
        approvedRoot,
      }),
    ).rejects.toThrow("OUTPUT_MUST_BE_EXTERNAL");
  });

  it("rejects an existing output and a link that escapes into the repository", async () => {
    const root = await temporaryRoot();
    const repositoryRoot = path.join(root, "repository");
    const approvedRoot = path.join(root, "evidence");
    const existingOutput = path.join(approvedRoot, "existing");
    await mkdir(repositoryRoot);
    await mkdir(approvedRoot);
    await mkdir(existingOutput);

    await expect(
      prepareNewExternalOutput({
        outputPath: existingOutput,
        repositoryRoot,
        approvedRoot,
      }),
    ).rejects.toThrow("OUTPUT_MUST_BE_EXTERNAL");

    const link = path.join(approvedRoot, "jump");
    await symlink(
      repositoryRoot,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      prepareNewExternalOutput({
        outputPath: path.join(link, "manifest"),
        repositoryRoot,
        approvedRoot,
      }),
    ).rejects.toThrow("OUTPUT_MUST_BE_EXTERNAL");
  });

  it("revalidates staging and accepts only regular external artifact inputs", async () => {
    const root = await temporaryRoot();
    const repositoryRoot = path.join(root, "repository");
    const approvedRoot = path.join(root, "evidence");
    await mkdir(repositoryRoot);
    await mkdir(approvedRoot);
    const prepared = await prepareNewExternalOutput({
      outputPath: path.join(approvedRoot, "run-1"),
      repositoryRoot,
      approvedRoot,
    });
    const staging = path.join(approvedRoot, ".run-1.staging");
    await mkdir(staging);
    await expect(
      revalidateExternalStaging(prepared, staging),
    ).resolves.toBeUndefined();

    const artifact = path.join(approvedRoot, "manifest.json");
    await writeFile(artifact, "{}", "utf8");
    await expect(
      assertExternalArtifactFile({
        artifactPath: artifact,
        repositoryRoot,
        approvedRoot,
      }),
    ).resolves.toBe(path.resolve(artifact));
    await expect(
      assertExternalArtifactFile({
        artifactPath: path.join(repositoryRoot, "manifest.json"),
        repositoryRoot,
        approvedRoot,
      }),
    ).rejects.toThrow("OUTPUT_MUST_BE_EXTERNAL");
  });
});
