import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

const BOUNDARY_ERROR = "OUTPUT_MUST_BE_EXTERNAL";

function normalizeForComparison(value: string): string {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function withinOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(
    normalizeForComparison(parent),
    normalizeForComparison(child),
  );
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function exists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return false;
    throw error;
  }
}

async function projectPhysicalPath(value: string): Promise<string> {
  let current = path.resolve(value);
  const missing: string[] = [];
  for (;;) {
    try {
      await lstat(current);
      const physical = await realpath(current);
      return path.join(physical, ...missing.reverse());
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw new Error(BOUNDARY_ERROR, { cause: error });
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

async function canonicalRoots(input: {
  repositoryRoot: string;
  approvedRoot: string;
}) {
  const repository = await realpath(path.resolve(input.repositoryRoot));
  const approved = await projectPhysicalPath(input.approvedRoot);
  if (withinOrEqual(repository, approved)) throw new Error(BOUNDARY_ERROR);
  return { repository, approved };
}

export type PreparedExternalOutput = {
  outputPath: string;
  repositoryRoot: string;
  approvedRoot: string;
  physicalOutputPath: string;
  physicalRepositoryRoot: string;
  physicalApprovedRoot: string;
};

export async function prepareNewExternalOutput(input: {
  outputPath: string;
  repositoryRoot: string;
  approvedRoot: string;
}): Promise<PreparedExternalOutput> {
  const outputPath = path.resolve(input.outputPath);
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const approvedRoot = path.resolve(input.approvedRoot);
  if (
    !path.isAbsolute(input.outputPath) ||
    !path.isAbsolute(input.repositoryRoot) ||
    !path.isAbsolute(input.approvedRoot) ||
    outputPath.includes("\0") ||
    withinOrEqual(repositoryRoot, outputPath) ||
    !withinOrEqual(approvedRoot, outputPath) ||
    normalizeForComparison(outputPath) ===
      normalizeForComparison(approvedRoot) ||
    (await exists(outputPath))
  )
    throw new Error(BOUNDARY_ERROR);

  const { repository, approved } = await canonicalRoots({
    repositoryRoot,
    approvedRoot,
  });
  const physicalOutputPath = await projectPhysicalPath(outputPath);
  if (
    withinOrEqual(repository, physicalOutputPath) ||
    !withinOrEqual(approved, physicalOutputPath) ||
    normalizeForComparison(physicalOutputPath) ===
      normalizeForComparison(approved)
  )
    throw new Error(BOUNDARY_ERROR);
  return {
    outputPath,
    repositoryRoot,
    approvedRoot,
    physicalOutputPath,
    physicalRepositoryRoot: repository,
    physicalApprovedRoot: approved,
  };
}

export async function revalidateExternalStaging(
  prepared: PreparedExternalOutput,
  stagingPath: string,
): Promise<void> {
  if (await exists(prepared.outputPath)) throw new Error(BOUNDARY_ERROR);
  const physicalStaging = await realpath(path.resolve(stagingPath));
  const physicalOutput = await projectPhysicalPath(prepared.outputPath);
  if (
    withinOrEqual(prepared.physicalRepositoryRoot, physicalStaging) ||
    withinOrEqual(prepared.physicalRepositoryRoot, physicalOutput) ||
    !withinOrEqual(prepared.physicalApprovedRoot, physicalStaging) ||
    !withinOrEqual(prepared.physicalApprovedRoot, physicalOutput)
  )
    throw new Error(BOUNDARY_ERROR);
}

export async function assertExternalArtifactFile(input: {
  artifactPath: string;
  repositoryRoot: string;
  approvedRoot: string;
}): Promise<string> {
  const artifactPath = path.resolve(input.artifactPath);
  const info = await lstat(artifactPath).catch((error: unknown) => {
    throw new Error(BOUNDARY_ERROR, { cause: error });
  });
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(BOUNDARY_ERROR);
  const { repository, approved } = await canonicalRoots(input);
  const physicalArtifact = await realpath(artifactPath);
  if (
    withinOrEqual(repository, physicalArtifact) ||
    !withinOrEqual(approved, physicalArtifact) ||
    normalizeForComparison(physicalArtifact) ===
      normalizeForComparison(approved)
  )
    throw new Error(BOUNDARY_ERROR);
  return physicalArtifact;
}
