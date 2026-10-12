import { isAbsolute } from "node:path";

const registryError = (message) => {
  const error = new Error(`WORKTREE_REGISTRY_INVALID: ${message}`);
  error.code = "WORKTREE_REGISTRY_INVALID";
  return error;
};

export function parseWorktreePorcelain(source) {
  const records = [];
  let current = null;

  const finish = () => {
    if (!current) return;
    if (!current.path || !current.headSha) {
      throw registryError("incomplete record");
    }
    records.push(current);
    current = null;
  };

  for (const field of String(source).split("\0")) {
    if (!field) {
      finish();
      continue;
    }

    const separator = field.indexOf(" ");
    const key = separator === -1 ? field : field.slice(0, separator);
    const value = separator === -1 ? "" : field.slice(separator + 1);

    if (key === "worktree") {
      finish();
      if (!isAbsolute(value) || value.includes("\0")) {
        throw registryError("unsafe worktree path");
      }
      current = {
        path: value.replaceAll("\\", "/"),
        headSha: null,
        branch: null,
        detached: false,
        bare: false,
        locked: false,
        lockReason: null,
        prunable: false,
        pruneReason: null,
      };
      continue;
    }

    if (!current) throw registryError("field before worktree");
    if (key === "HEAD") current.headSha = value;
    else if (key === "branch") {
      current.branch = value.replace(/^refs\/heads\//, "");
    } else if (key === "detached") current.detached = true;
    else if (key === "bare") current.bare = true;
    else if (key === "locked") {
      current.locked = true;
      current.lockReason = value || null;
    } else if (key === "prunable") {
      current.prunable = true;
      current.pruneReason = value || null;
    }
  }
  finish();

  const paths = records.map(({ path }) => path.toLowerCase());
  if (new Set(paths).size !== paths.length) {
    throw registryError("duplicate path");
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

export function classifyWorktree(input) {
  if (!input.readable) return "unreadable";
  if (input.isPrimary) return "primary";
  if (input.activeResolution?.task) return "active";
  if (input.trackedDirtyPaths.length > 0) return "unowned-dirty";
  if (input.fullyMerged) return "dormant-merged";
  return "dormant-ahead";
}
